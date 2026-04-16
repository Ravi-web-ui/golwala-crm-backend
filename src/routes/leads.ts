import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";
import { Prisma } from "@prisma/client";
import { notifyNewLead } from "../services/notify";

const router = Router();

// camelCase → snake_case transformer
function toSnake(lead: any) {
  return {
    id:             lead.id,
    full_name:      lead.fullName,
    country_code:   lead.countryCode,
    phone:          lead.phone,
    email:          lead.email,
    city:           lead.city,
    state:          lead.state,
    program_level:  lead.programLevel,
    program:        lead.program,
    hear_about:     lead.hearAbout,
    status:         lead.status,
    assigned_to:    lead.assignedTo,
    notes:          lead.notes,
    utm_source:     lead.utmSource,
    utm_medium:     lead.utmMedium,
    utm_campaign:   lead.utmCampaign,
    utm_term:       lead.utmTerm,
    utm_content:    lead.utmContent,
    utm_name:       lead.utmName,
    form_source:    lead.formSource,
    created_at:     lead.createdAt,
    updated_at:     lead.updatedAt,
    assigned_admin: lead.assignedAdmin,
  };
}

// Auto-route: find manager assigned to this program
async function autoAssign(program: string | undefined): Promise<number | null> {
  if (!program) return null;
  const assignment = await prisma.programAssignment.findFirst({
    where: { program: { equals: program } },
    include: { admin: { select: { id: true } } },
  });
  return assignment?.admin.id ?? null;
}

// Safe parseInt helper
function safeInt(val: any): number {
  const n = parseInt(val);
  return isNaN(n) ? 0 : n;
}

// ── PUBLIC: Submit lead from website form ─────────────────────────────────────
router.post("/", async (req, res: Response): Promise<void> => {
  const { full_name, country_code, phone, email, city, state, program_level, program, hear_about,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_name, form_source } = req.body;
  if (!full_name || !phone || !email) { res.status(400).json({ error: "Required fields missing" }); return; }
  try {
    const assignedTo = await autoAssign(program);
    const lead = await prisma.lead.create({
      data: {
        fullName: full_name, countryCode: country_code || "+91", phone, email, city, state,
        programLevel: program_level, program, hearAbout: hear_about,
        utmSource: utm_source, utmMedium: utm_medium, utmCampaign: utm_campaign,
        utmTerm: utm_term, utmContent: utm_content, utmName: utm_name, formSource: form_source,
        assignedTo,
      },
    });
    await prisma.activity.create({ data: { leadId: lead.id, adminId: assignedTo ?? 1, type: "lead_created", note: "Lead submitted via website form" } }).catch(() => {});

    // WhatsApp notifications (non-blocking)
    (async () => {
      try {
        const recipients: { name: string; phone: string | null; email?: string | null }[] = [];
        // Assigned manager/admin
        if (assignedTo) {
          const assigned = await prisma.adminUser.findUnique({ where: { id: assignedTo }, select: { name: true, phone: true, email: true } });
          if (assigned) recipients.push(assigned);
        }
        // Super admin(s)
        const superAdmins = await prisma.adminUser.findMany({ where: { role: "super_admin" }, select: { name: true, phone: true, email: true } });
        for (const sa of superAdmins) {
          if (!recipients.find(r => r.email === sa.email)) recipients.push(sa);
        }
        await notifyNewLead({ fullName: full_name, phone, email, program, programLevel: program_level, city, source: form_source || "Website Form" }, recipients);
      } catch {}
    })();

    res.json({ message: "Application submitted successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN: Manually add lead ──────────────────────────────────────────────────
router.post("/manual", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { full_name, country_code, phone, email, city, state, program_level, program,
    hear_about, status, assigned_to, notes, utm_source, utm_medium, utm_campaign, utm_name } = req.body;
  if (!full_name || !phone) { res.status(400).json({ error: "Name and phone required" }); return; }
  try {
    const assignedTo = assigned_to ?? await autoAssign(program) ?? req.user!.id;
    const lead = await prisma.lead.create({
      data: {
        fullName: full_name, countryCode: country_code || "+91", phone, email: email || "",
        city, state, programLevel: program_level, program, hearAbout: hear_about,
        status: status || "new", assignedTo, notes,
        utmSource: utm_source, utmMedium: utm_medium, utmCampaign: utm_campaign, utmName: utm_name,
      },
    });
    await prisma.activity.create({ data: { leadId: lead.id, adminId: req.user!.id, type: "lead_created", note: "Lead added manually by " + req.user!.name } });

    // WhatsApp notifications (non-blocking)
    (async () => {
      try {
        const recipients: { name: string; phone: string | null; email?: string | null }[] = [];
        if (assignedTo && assignedTo !== req.user!.id) {
          const assigned = await prisma.adminUser.findUnique({ where: { id: assignedTo }, select: { name: true, phone: true, email: true } });
          if (assigned) recipients.push(assigned);
        }
        const superAdmins = await prisma.adminUser.findMany({ where: { role: "super_admin" }, select: { name: true, phone: true, email: true } });
        for (const sa of superAdmins) {
          if (!recipients.find(r => r.email === sa.email)) recipients.push(sa);
        }
        await notifyNewLead({ fullName: full_name, phone, email, program, programLevel: program_level, city, source: "Manual Entry" }, recipients);
      } catch {}
    })();

    res.json({ message: "Lead created", lead: toSnake(lead) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── ADMIN: CSV bulk import ────────────────────────────────────────────────────
router.post("/import-csv", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows, mapping, assigned_to, auto_assign } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "No rows provided" }); return; }

  let admins: any[] = [];
  if (auto_assign) {
    admins = await prisma.adminUser.findMany({ where: { role: { in: ["admin", "manager"] } }, select: { id: true } });
  }

  let created = 0, skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: string) => {
      if (!mapping) return row[field] || "";
      const csvCol = Object.keys(mapping).find(k => mapping[k] === field);
      return csvCol ? (row[csvCol] || "") : (row[field] || "");
    };
    const phone = get("phone")?.toString().replace(/\D/g, "");
    if (!phone) { skipped++; continue; }
    const exists = await prisma.lead.findFirst({ where: { phone } });
    if (exists) { skipped++; continue; }
    const assignTo = auto_assign && admins.length > 0
      ? admins[i % admins.length].id
      : (assigned_to || null);
    try {
      const lead = await prisma.lead.create({
        data: {
          fullName: get("full_name") || get("name") || "Unknown",
          countryCode: get("country_code") || "+91",
          phone,
          email: get("email") || "",
          city: get("city") || null,
          state: get("state") || null,
          programLevel: get("program_level") || null,
          program: get("program") || null,
          hearAbout: get("hear_about") || null,
          status: get("status") || "new",
          assignedTo: assignTo,
          utmSource: get("utm_source") || null,
          utmCampaign: get("utm_campaign") || null,
          utmMedium: get("utm_medium") || null,
          utmName: get("utm_name") || null,
        },
      });
      await prisma.activity.create({ data: { leadId: lead.id, adminId: req.user!.id, type: "lead_created", note: "Imported via CSV" } }).catch(() => {});
      created++;
    } catch { skipped++; }
  }
  res.json({ message: `Imported ${created} leads, skipped ${skipped}` });
});

// ── GET all leads with filters ────────────────────────────────────────────────
router.get("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, program_level, city, state, program, hear_about, search, from, to, assigned_to, page = "1", limit = "10" } = req.query as Record<string, string>;

  const where: Prisma.LeadWhereInput = {};
  if (req.user?.role === "manager") where.assignedTo = req.user!.id;
  if (status) where.status = status;
  if (program_level) where.programLevel = program_level;
  if (city) where.city = city;
  if (state) where.state = state;
  if (program) where.program = { contains: program };
  if (hear_about) where.hearAbout = hear_about;
  if (assigned_to) where.assignedTo = safeInt(assigned_to);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from + "T00:00:00+05:30");
    if (to)   where.createdAt.lte = new Date(to + "T23:59:59+05:30");
  }
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email:    { contains: search } },
      { phone:    { contains: search } },
    ];
  }

  // Program-based access restriction
  if (req.user?.role !== "super_admin") {
    const assignments = await prisma.programAssignment.findMany({ where: { adminId: req.user!.id } });
    if (assignments.length > 0) {
      const programs = assignments.map((a: any) => a.program);
      if (!program) where.program = { in: programs };
    }
  }

  const pageNum  = Math.max(1, safeInt(page));
  const limitNum = Math.min(Math.max(1, safeInt(limit)), 10000);
  const skip     = (pageNum - 1) * limitNum;

  try {
    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, include: { assignedAdmin: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip, take: limitNum }),
      prisma.lead.count({ where }),
    ]);
    res.json({ leads: leads.map(toSnake), total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Distinct field values (for filter dropdowns) ──────────────────────────────
router.get("/meta/distinct", auth, async (_req: AuthRequest, res: Response): Promise<void> => {
  const [programs, cities, states] = await Promise.all([
    prisma.lead.findMany({ where: { program: { not: null } }, select: { program: true }, distinct: ["program"], orderBy: { program: "asc" } }),
    prisma.lead.findMany({ where: { city:    { not: null } }, select: { city:    true }, distinct: ["city"],    orderBy: { city:    "asc" } }),
    prisma.lead.findMany({ where: { state:   { not: null } }, select: { state:   true }, distinct: ["state"],   orderBy: { state:   "asc" } }),
  ]);
  res.json({
    programs: programs.map(p => p.program).filter(Boolean),
    cities:   cities.map(c => c.city).filter(Boolean),
    states:   states.map(s => s.state).filter(Boolean),
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/meta/stats", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;
  const where: Prisma.LeadWhereInput = {};
  if (req.user?.role === "manager") where.assignedTo = req.user!.id;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from + "T00:00:00+05:30");
    if (to)   where.createdAt.lte = new Date(to + "T23:59:59+05:30");
  }
  const [total, byStatus, byLevel, today] = await prisma.$transaction([
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"],       where, _count: { _all: true }, orderBy: { _count: { status:       "desc" } } }),
    prisma.lead.groupBy({ by: ["programLevel"], where, _count: { _all: true }, orderBy: { _count: { programLevel: "desc" } } }),
    prisma.lead.count({ where: { ...where, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  res.json({
    total, today,
    byStatus: byStatus.map(s => ({ status: s.status,             _count: (s._count as any)._all ?? 0 })),
    byLevel:  byLevel.map(l  => ({ programLevel: l.programLevel, _count: (l._count as any)._all ?? 0 })),
  });
});

// ── Kanban ────────────────────────────────────────────────────────────────────
router.get("/kanban", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Prisma.LeadWhereInput = {};
  if (req.user?.role === "manager") where.assignedTo = req.user!.id;
  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, fullName: true, phone: true, countryCode: true, email: true, program: true, programLevel: true, status: true, assignedTo: true, createdAt: true, assignedAdmin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const columns: Record<string, any[]> = { new: [], contacted: [], interested: [], not_interested: [], admitted: [], lost: [] };
  leads.forEach(l => { if (columns[l.status]) columns[l.status].push(l); });
  res.json(columns);
});

// ── Get single lead ───────────────────────────────────────────────────────────
router.get("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = safeInt(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const lead = await prisma.lead.findUnique({ where: { id }, include: { assignedAdmin: { select: { name: true } } } });
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toSnake(lead));
});

// ── Update lead ───────────────────────────────────────────────────────────────
router.patch("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const leadId = safeInt(req.params.id);
  if (!leadId) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, assigned_to, notes, full_name, phone, email, city, state,
    program_level, program, hear_about, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, utm_name } = req.body;

  const data: any = {};
  if (status       !== undefined) data.status       = status;
  if (assigned_to  !== undefined) data.assignedTo   = assigned_to || null;
  if (notes        !== undefined) data.notes        = notes;
  if (full_name    !== undefined) data.fullName      = full_name;
  if (phone        !== undefined) data.phone        = phone;
  if (email        !== undefined) data.email        = email;
  if (city         !== undefined) data.city         = city;
  if (state        !== undefined) data.state        = state;
  if (program_level !== undefined) data.programLevel = program_level;
  if (program      !== undefined) data.program      = program;
  if (hear_about   !== undefined) data.hearAbout    = hear_about;
  if (utm_source   !== undefined) data.utmSource    = utm_source;
  if (utm_medium   !== undefined) data.utmMedium    = utm_medium;
  if (utm_campaign !== undefined) data.utmCampaign  = utm_campaign;
  if (utm_term     !== undefined) data.utmTerm      = utm_term;
  if (utm_content  !== undefined) data.utmContent   = utm_content;
  if (utm_name     !== undefined) data.utmName      = utm_name;

  if (!Object.keys(data).length) { res.status(400).json({ error: "Nothing to update" }); return; }

  const oldLead = await prisma.lead.findUnique({ where: { id: leadId } });
  await prisma.lead.update({ where: { id: leadId }, data });

  if (status && oldLead && status !== oldLead.status) {
    await prisma.activity.create({ data: { leadId, adminId: req.user!.id, type: "status_change",
      note: `Status changed from ${oldLead.status} → ${status}` } }).catch(() => {});
  }
  if (assigned_to !== undefined && oldLead && assigned_to !== oldLead.assignedTo) {
    const newAdmin = assigned_to ? await prisma.adminUser.findUnique({ where: { id: assigned_to }, select: { name: true } }) : null;
    await prisma.activity.create({ data: { leadId, adminId: req.user!.id, type: "note",
      note: `Lead assigned to ${newAdmin?.name || "Unassigned"}` } }).catch(() => {});
  }
  res.json({ message: "Updated" });
});

// ── Delete lead ───────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const leadId = safeInt(req.params.id);
  if (!leadId) { res.status(400).json({ error: "Invalid id" }); return; }
  const role = req.user?.role;

  if (role === "manager") { res.status(403).json({ error: "Managers cannot delete leads" }); return; }

  if (role === "admin") {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedTo: true } });
    if (!lead) { res.status(404).json({ error: "Not found" }); return; }
    if (lead.assignedTo !== req.user!.id) {
      const perm = await prisma.permission.findUnique({ where: { adminId: req.user!.id } });
      if (!perm?.canDeleteLeads) { res.status(403).json({ error: "No permission to delete this lead" }); return; }
    }
  }
  await prisma.lead.delete({ where: { id: leadId } });
  res.json({ message: "Deleted" });
});

export default router;

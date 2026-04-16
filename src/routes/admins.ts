import { Router, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db";
import { auth, superOnly, AuthRequest } from "../middleware/auth";
import { notifyNewAdmin } from "../services/notify";

const router = Router();

// Get all admins with permissions + program assignments
router.get("/", auth, superOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  const admins = await prisma.adminUser.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, permissions: true, programAssignments: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(admins);
});

// Get current user's permissions
router.get("/my-permissions", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === "super_admin") {
    res.json({ canViewLeads: true, canEditLeads: true, canDeleteLeads: true, canExportLeads: true, canViewReports: true, canManageFilters: true });
    return;
  }
  const perm = await prisma.permission.findUnique({ where: { adminId: req.user!.id } });
  res.json(perm || { canViewLeads: true, canEditLeads: true, canDeleteLeads: false, canExportLeads: false, canViewReports: true, canManageFilters: true });
});

// Create sub-admin / manager
router.post("/", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "Name, email and password required" }); return; }
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: "Email already exists" }); return; }
    const hash = await bcrypt.hash(password, 10);
    const validRole = ["super_admin", "admin", "manager"].includes(role) ? role : "admin";
    const newAdmin = await prisma.adminUser.create({ data: { name, email, password: hash, role: validRole, phone: phone || null } });
    await prisma.permission.create({
      data: {
        adminId: newAdmin.id,
        canViewLeads: true, canEditLeads: true, canDeleteLeads: false,
        canExportLeads: validRole === "admin", canViewReports: true, canManageFilters: true,
      },
    });

    // WhatsApp notifications (non-blocking)
    (async () => {
      try {
        const superAdmin = await prisma.adminUser.findFirst({ where: { role: "super_admin" }, select: { phone: true, email: true } });
        await notifyNewAdmin({ name, email, role: validRole, phone: phone || null }, superAdmin?.phone || null, superAdmin?.email || null);
      } catch {}
    })();

    res.json({ message: "User created successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Update permissions
router.patch("/:id/permissions", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = parseInt(req.params.id as string);
  const { canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters } = req.body;
  try {
    await prisma.permission.upsert({
      where: { adminId },
      update: { canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters },
      create: { adminId, canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters },
    });
    res.json({ message: "Permissions updated" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Update program assignments for a manager/admin
router.put("/:id/programs", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = parseInt(req.params.id as string);
  const { programs } = req.body; // string[]
  if (!Array.isArray(programs)) { res.status(400).json({ error: "programs array required" }); return; }
  // Replace all assignments
  await prisma.programAssignment.deleteMany({ where: { adminId } });
  if (programs.length > 0) {
    await prisma.programAssignment.createMany({
      data: programs.map((p: string) => ({ adminId, program: p })),
      skipDuplicates: true,
    });
  }
  res.json({ message: "Programs updated" });
});

// Update own profile (name / email / phone) — must be before /:id
router.patch("/me", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, phone } = req.body;
  if (!name && !email && phone === undefined) { res.status(400).json({ error: "Nothing to update" }); return; }
  const data: any = {};
  if (name)  data.name  = name;
  if (phone !== undefined) data.phone = phone || null;
  if (email) {
    const conflict = await prisma.adminUser.findFirst({ where: { email, NOT: { id: req.user!.id } } });
    if (conflict) { res.status(400).json({ error: "Email already in use" }); return; }
    data.email = email;
  }
  const updated = await prisma.adminUser.update({ where: { id: req.user!.id }, data, select: { id: true, name: true, email: true, phone: true, role: true } });
  res.json({ message: "Profile updated", user: updated });
});

// Update admin name/role
router.patch("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, role } = req.body;
  const data: any = {};
  if (name) data.name = name;
  if (role && ["super_admin","admin","manager"].includes(role)) data.role = role;
  await prisma.adminUser.update({ where: { id: parseInt(req.params.id as string) }, data });
  res.json({ message: "Updated" });
});

// Change own password
router.post("/change-password", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) { res.status(400).json({ error: "Both fields required" }); return; }
  if (new_password.length < 6) { res.status(400).json({ error: "Min 6 characters" }); return; }
  const user = await prisma.adminUser.findUnique({ where: { id: req.user!.id } });
  const valid = await bcrypt.compare(current_password, user!.password);
  if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
  const hash = await bcrypt.hash(new_password, 10);
  await prisma.adminUser.update({ where: { id: req.user!.id }, data: { password: hash } });
  res.json({ message: "Password changed successfully" });
});

// Super admin reset password
router.post("/:id/reset-password", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) { res.status(400).json({ error: "Min 6 characters" }); return; }
  const hash = await bcrypt.hash(new_password, 10);
  await prisma.adminUser.update({ where: { id: parseInt(req.params.id as string) }, data: { password: hash } });
  res.json({ message: "Password reset successfully" });
});

// Delete admin
router.delete("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  if (parseInt(req.params.id as string) === req.user!.id) { res.status(400).json({ error: "Cannot delete yourself" }); return; }
  await prisma.adminUser.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

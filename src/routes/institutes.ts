import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, superOnly, AuthRequest } from "../middleware/auth";

const router = Router();

// ── Institutes ────────────────────────────────────────────────────────────────

// GET /api/institutes
router.get("/", auth, async (_req, res: Response): Promise<void> => {
  const institutes = await prisma.institute.findMany({
    orderBy: { name: "asc" },
    include: { branches: { orderBy: { name: "asc" } } },
  });
  res.json(institutes);
});

// POST /api/institutes
router.post("/", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, genioSubdomain, genioCollegeId } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Institute name is required" }); return; }
  try {
    const inst = await prisma.institute.create({
      data: {
        name: name.trim(),
        genioSubdomain: genioSubdomain?.trim() || null,
        genioCollegeId: genioCollegeId ? parseInt(genioCollegeId) : null,
      },
    });
    res.json(inst);
  } catch (e: any) {
    if (e.code === "P2002") { res.status(400).json({ error: "Institute name already exists" }); return; }
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/institutes/:id
router.patch("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { name, genioSubdomain, genioCollegeId } = req.body;
  const data: any = {};
  if (name?.trim())             data.name            = name.trim();
  if (genioSubdomain !== undefined) data.genioSubdomain  = genioSubdomain?.trim() || null;
  if (genioCollegeId !== undefined) data.genioCollegeId  = genioCollegeId ? parseInt(genioCollegeId) : null;
  try {
    const inst = await prisma.institute.update({ where: { id }, data });
    res.json(inst);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/institutes/:id
router.delete("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  await prisma.institute.delete({ where: { id } });
  res.json({ message: "Deleted" });
});

// ── Branches ──────────────────────────────────────────────────────────────────

// GET /api/institutes/:id/branches
router.get("/:id/branches", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const instituteId = parseInt(req.params.id as string);
  const branches = await prisma.branch.findMany({
    where: { instituteId },
    orderBy: { name: "asc" },
  });
  res.json(branches);
});

// POST /api/institutes/:id/branches
router.post("/:id/branches", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const instituteId = parseInt(req.params.id as string);
  const { name, genioBranchId } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Branch name is required" }); return; }
  try {
    const branch = await prisma.branch.create({
      data: {
        instituteId,
        name: name.trim(),
        genioBranchId: genioBranchId ? parseInt(genioBranchId) : null,
      },
    });
    res.json(branch);
  } catch (e: any) {
    if (e.code === "P2002") { res.status(400).json({ error: "Branch already exists for this institute" }); return; }
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/institutes/:id/branches/:branchId
router.patch("/:id/branches/:branchId", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const branchId = parseInt(req.params.branchId as string);
  const { name, genioBranchId } = req.body;
  const data: any = {};
  if (name?.trim())              data.name          = name.trim();
  if (genioBranchId !== undefined) data.genioBranchId = genioBranchId ? parseInt(genioBranchId) : null;
  const branch = await prisma.branch.update({ where: { id: branchId }, data });
  res.json(branch);
});

// DELETE /api/institutes/:id/branches/:branchId
router.delete("/:id/branches/:branchId", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const branchId = parseInt(req.params.branchId as string);
  await prisma.branch.delete({ where: { id: branchId } });
  res.json({ message: "Deleted" });
});

export default router;

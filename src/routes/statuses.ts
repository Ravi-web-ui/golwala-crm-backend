import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, superOnly, AuthRequest } from "../middleware/auth";

const router = Router();

// Get all statuses
router.get("/", auth, async (_req, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "private, max-age=300"); // 5 min client cache
  const statuses = await prisma.leadStatusConfig.findMany({ orderBy: [{ stage: "asc" }, { order: "asc" }] });
  res.json(statuses);
});

// Create status (super_admin only)
router.post("/", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { label, color, stage } = req.body;
  if (!label || !color || !stage) { res.status(400).json({ error: "label, color and stage required" }); return; }
  const value = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const count = await prisma.leadStatusConfig.count({ where: { stage } });
  try {
    const s = await prisma.leadStatusConfig.create({ data: { label, value, color, stage, order: count } });
    res.json(s);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Update status
router.patch("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { label, color, stage } = req.body;
  const data: any = {};
  if (label) { data.label = label; data.value = label.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""); }
  if (color) data.color = color;
  if (stage) data.stage = stage;
  await prisma.leadStatusConfig.update({ where: { id: parseInt(req.params.id as string) }, data });
  res.json({ message: "Updated" });
});

// Delete status
router.delete("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const s = await prisma.leadStatusConfig.findUnique({ where: { id: parseInt(req.params.id as string) } });
  if (s?.isDefault) { res.status(400).json({ error: "Cannot delete default status" }); return; }
  await prisma.leadStatusConfig.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

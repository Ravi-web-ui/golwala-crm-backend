import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

// Get filters - super_admin sees all, others see own + shared
router.get("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const where = req.user?.role === "super_admin" ? {} : {
    OR: [{ createdBy: req.user!.id }, { isShared: true }]
  };
  const filters = await prisma.filter.findMany({
    where,
    include: { admin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(filters);
});

// Create filter with conditions
router.post("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, filter_config, conditions, is_shared } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const config = conditions ? JSON.stringify(conditions) : (filter_config ? JSON.stringify(filter_config) : "{}");
  await prisma.filter.create({
    data: {
      name,
      createdBy: req.user!.id,
      filterConfig: config,
      isShared: is_shared || false,
    }
  });
  res.json({ message: "Filter saved" });
});

// Update filter
router.patch("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, filter_config, conditions, is_shared } = req.body;
  const data: any = {};
  if (name) data.name = name;
  if (conditions) data.filterConfig = JSON.stringify(conditions);
  else if (filter_config) data.filterConfig = JSON.stringify(filter_config);
  if (is_shared !== undefined) data.isShared = is_shared;
  await prisma.filter.update({ where: { id: parseInt(req.params.id as string) }, data });
  res.json({ message: "Updated" });
});

// Delete filter
router.delete("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const filter = await prisma.filter.findUnique({ where: { id: parseInt(req.params.id as string) } });
  if (!filter) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user?.role !== "super_admin" && filter.createdBy !== req.user!.id) {
    res.status(403).json({ error: "Not allowed" }); return;
  }
  await prisma.filter.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

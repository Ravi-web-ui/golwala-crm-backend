import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";
import { ActivityType } from "@prisma/client";

const router = Router();

// Get all activities for a lead
router.get("/:leadId", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const activities = await prisma.activity.findMany({
    where: { leadId: parseInt(req.params.leadId as string) },
    include: { admin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(activities);
});

// Add activity
router.post("/:leadId", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, note } = req.body;
  if (!type) { res.status(400).json({ error: "Type required" }); return; }
  const activity = await prisma.activity.create({
    data: { leadId: parseInt(req.params.leadId as string), adminId: req.user!.id, type: type as ActivityType, note },
    include: { admin: { select: { name: true } } },
  });
  res.json(activity);
});

export default router;

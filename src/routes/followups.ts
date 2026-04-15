import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";
import { FollowUpStatus } from "@prisma/client";

const router = Router();

// Get follow-ups for a lead
router.get("/lead/:leadId", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const followUps = await prisma.followUp.findMany({
    where: { leadId: parseInt(req.params.leadId as string) },
    include: { admin: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(followUps);
});

// Today's follow-ups for current user
router.get("/today", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  const where: any = {
    scheduledAt: { gte: start, lte: end },
    status: "pending",
  };
  if (req.user?.role !== "super_admin") where.adminId = req.user!.id;
  const followUps = await prisma.followUp.findMany({
    where,
    include: { lead: { select: { id: true, fullName: true, phone: true, countryCode: true, program: true, status: true } }, admin: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(followUps);
});

// All upcoming follow-ups (for dashboard)
router.get("/upcoming", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const where: any = { scheduledAt: { gte: now }, status: "pending" };
  if (req.user?.role !== "super_admin") where.adminId = req.user!.id;
  const followUps = await prisma.followUp.findMany({
    where,
    include: { lead: { select: { id: true, fullName: true, phone: true, countryCode: true, program: true, status: true } }, admin: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
  res.json(followUps);
});

// Create follow-up
router.post("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { lead_id, scheduled_at, note } = req.body;
  if (!lead_id || !scheduled_at) { res.status(400).json({ error: "lead_id and scheduled_at required" }); return; }
  const followUp = await prisma.followUp.create({
    data: { leadId: lead_id, adminId: req.user!.id, scheduledAt: new Date(scheduled_at), note },
    include: { admin: { select: { name: true } } },
  });
  // Log activity
  await prisma.activity.create({
    data: { leadId: lead_id, adminId: req.user!.id, type: "follow_up", note: `Follow-up scheduled for ${new Date(scheduled_at).toLocaleString("en-IN")}${note ? ": " + note : ""}` },
  });
  res.json(followUp);
});

// Update follow-up status
router.patch("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const followUp = await prisma.followUp.update({
    where: { id: parseInt(req.params.id as string) },
    data: { status: status as FollowUpStatus },
  });
  res.json(followUp);
});

// Delete follow-up
router.delete("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.followUp.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

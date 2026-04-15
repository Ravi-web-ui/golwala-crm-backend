import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";
import { CallOutcome } from "@prisma/client";

const router = Router();

// Get call logs for a lead
router.get("/:leadId", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const logs = await prisma.callLog.findMany({
    where: { leadId: parseInt(req.params.leadId as string) },
    include: { admin: { select: { name: true } } },
    orderBy: { calledAt: "desc" },
  });
  res.json(logs);
});

// Add call log
router.post("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { lead_id, called_at, duration, outcome, notes } = req.body;
  if (!lead_id || !outcome) { res.status(400).json({ error: "lead_id and outcome required" }); return; }
  const log = await prisma.callLog.create({
    data: {
      leadId: lead_id, adminId: req.user!.id,
      calledAt: called_at ? new Date(called_at) : new Date(),
      duration: duration ? parseInt(duration) : null,
      outcome: outcome as CallOutcome, notes,
    },
    include: { admin: { select: { name: true } } },
  });
  // Auto-log activity
  await prisma.activity.create({
    data: {
      leadId: lead_id, adminId: req.user!.id, type: "call",
      note: `Call ${outcome.replace("_", " ")}${duration ? ` · ${duration} min` : ""}${notes ? " · " + notes : ""}`,
    },
  });
  res.json(log);
});

export default router;

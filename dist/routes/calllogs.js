"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get call logs for a lead
router.get("/:leadId", auth_1.auth, async (req, res) => {
    const logs = await db_1.prisma.callLog.findMany({
        where: { leadId: parseInt(req.params.leadId) },
        include: { admin: { select: { name: true } } },
        orderBy: { calledAt: "desc" },
    });
    res.json(logs);
});
// Add call log
router.post("/", auth_1.auth, async (req, res) => {
    const { lead_id, called_at, duration, outcome, notes } = req.body;
    if (!lead_id || !outcome) {
        res.status(400).json({ error: "lead_id and outcome required" });
        return;
    }
    const log = await db_1.prisma.callLog.create({
        data: {
            leadId: lead_id, adminId: req.user.id,
            calledAt: called_at ? new Date(called_at) : new Date(),
            duration: duration ? parseInt(duration) : null,
            outcome: outcome, notes,
        },
        include: { admin: { select: { name: true } } },
    });
    // Auto-log activity
    await db_1.prisma.activity.create({
        data: {
            leadId: lead_id, adminId: req.user.id, type: "call",
            note: `Call ${outcome.replace("_", " ")}${duration ? ` · ${duration} min` : ""}${notes ? " · " + notes : ""}`,
        },
    });
    res.json(log);
});
exports.default = router;

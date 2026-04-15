"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get follow-ups for a lead
router.get("/lead/:leadId", auth_1.auth, async (req, res) => {
    const followUps = await db_1.prisma.followUp.findMany({
        where: { leadId: parseInt(req.params.leadId) },
        include: { admin: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
    });
    res.json(followUps);
});
// Today's follow-ups for current user
router.get("/today", auth_1.auth, async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const where = {
        scheduledAt: { gte: start, lte: end },
        status: "pending",
    };
    if (req.user?.role !== "super_admin")
        where.adminId = req.user.id;
    const followUps = await db_1.prisma.followUp.findMany({
        where,
        include: { lead: { select: { id: true, fullName: true, phone: true, countryCode: true, program: true, status: true } }, admin: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
    });
    res.json(followUps);
});
// All upcoming follow-ups (for dashboard)
router.get("/upcoming", auth_1.auth, async (req, res) => {
    const now = new Date();
    const where = { scheduledAt: { gte: now }, status: "pending" };
    if (req.user?.role !== "super_admin")
        where.adminId = req.user.id;
    const followUps = await db_1.prisma.followUp.findMany({
        where,
        include: { lead: { select: { id: true, fullName: true, phone: true, countryCode: true, program: true, status: true } }, admin: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 20,
    });
    res.json(followUps);
});
// Create follow-up
router.post("/", auth_1.auth, async (req, res) => {
    const { lead_id, scheduled_at, note } = req.body;
    if (!lead_id || !scheduled_at) {
        res.status(400).json({ error: "lead_id and scheduled_at required" });
        return;
    }
    const followUp = await db_1.prisma.followUp.create({
        data: { leadId: lead_id, adminId: req.user.id, scheduledAt: new Date(scheduled_at), note },
        include: { admin: { select: { name: true } } },
    });
    // Log activity
    await db_1.prisma.activity.create({
        data: { leadId: lead_id, adminId: req.user.id, type: "follow_up", note: `Follow-up scheduled for ${new Date(scheduled_at).toLocaleString("en-IN")}${note ? ": " + note : ""}` },
    });
    res.json(followUp);
});
// Update follow-up status
router.patch("/:id", auth_1.auth, async (req, res) => {
    const { status } = req.body;
    const followUp = await db_1.prisma.followUp.update({
        where: { id: parseInt(req.params.id) },
        data: { status: status },
    });
    res.json(followUp);
});
// Delete follow-up
router.delete("/:id", auth_1.auth, async (req, res) => {
    await db_1.prisma.followUp.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
});
exports.default = router;

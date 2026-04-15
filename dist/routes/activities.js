"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all activities for a lead
router.get("/:leadId", auth_1.auth, async (req, res) => {
    const activities = await db_1.prisma.activity.findMany({
        where: { leadId: parseInt(req.params.leadId) },
        include: { admin: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json(activities);
});
// Add activity
router.post("/:leadId", auth_1.auth, async (req, res) => {
    const { type, note } = req.body;
    if (!type) {
        res.status(400).json({ error: "Type required" });
        return;
    }
    const activity = await db_1.prisma.activity.create({
        data: { leadId: parseInt(req.params.leadId), adminId: req.user.id, type: type, note },
        include: { admin: { select: { name: true } } },
    });
    res.json(activity);
});
exports.default = router;

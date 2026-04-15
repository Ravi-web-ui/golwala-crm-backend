"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all statuses
router.get("/", auth_1.auth, async (_req, res) => {
    res.setHeader("Cache-Control", "private, max-age=300"); // 5 min client cache
    const statuses = await db_1.prisma.leadStatusConfig.findMany({ orderBy: [{ stage: "asc" }, { order: "asc" }] });
    res.json(statuses);
});
// Create status (super_admin only)
router.post("/", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { label, color, stage } = req.body;
    if (!label || !color || !stage) {
        res.status(400).json({ error: "label, color and stage required" });
        return;
    }
    const value = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const count = await db_1.prisma.leadStatusConfig.count({ where: { stage } });
    try {
        const s = await db_1.prisma.leadStatusConfig.create({ data: { label, value, color, stage, order: count } });
        res.json(s);
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// Update status
router.patch("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { label, color, stage } = req.body;
    const data = {};
    if (label) {
        data.label = label;
        data.value = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    }
    if (color)
        data.color = color;
    if (stage)
        data.stage = stage;
    await db_1.prisma.leadStatusConfig.update({ where: { id: parseInt(req.params.id) }, data });
    res.json({ message: "Updated" });
});
// Delete status
router.delete("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const s = await db_1.prisma.leadStatusConfig.findUnique({ where: { id: parseInt(req.params.id) } });
    if (s?.isDefault) {
        res.status(400).json({ error: "Cannot delete default status" });
        return;
    }
    await db_1.prisma.leadStatusConfig.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/site-config — public (website reads this)
router.get("/", async (_req, res) => {
    try {
        let config = await db_1.prisma.siteConfig.findUnique({ where: { key: "topbar" } });
        if (!config) {
            config = await db_1.prisma.siteConfig.create({
                data: { key: "topbar", topbarText: "Admissions Open for 2027-28", buttonName: "Apply Now", buttonLink: "/admissions", enabled: true },
            });
        }
        res.json(config);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/site-config/topbar — admin only
router.put("/topbar", auth_1.auth, async (req, res) => {
    const { topbarText, buttonName, buttonLink, enabled } = req.body;
    try {
        const config = await db_1.prisma.siteConfig.upsert({
            where: { key: "topbar" },
            update: { topbarText, buttonName, buttonLink, enabled },
            create: { key: "topbar", topbarText, buttonName, buttonLink, enabled: enabled ?? true },
        });
        res.json(config);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;

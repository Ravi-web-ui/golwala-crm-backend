"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public - submit contact form
router.post("/", async (req, res) => {
    const { full_name, phone, email, program, message } = req.body;
    if (!full_name || !email || !message) {
        res.status(400).json({ error: "Name, email and message required" });
        return;
    }
    try {
        await db_1.prisma.contactInquiry.create({
            data: { fullName: full_name, phone, email, program, message },
        });
        res.json({ message: "Inquiry submitted successfully" });
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// Admin - get all inquiries
router.get("/", auth_1.auth, async (_req, res) => {
    const inquiries = await db_1.prisma.contactInquiry.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.json(inquiries);
});
// Admin - update status
router.patch("/:id", auth_1.auth, async (req, res) => {
    const { status } = req.body;
    await db_1.prisma.contactInquiry.update({
        where: { id: parseInt(req.params.id) },
        data: { status },
    });
    res.json({ message: "Updated" });
});
// Admin - delete
router.delete("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    await db_1.prisma.contactInquiry.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
});
exports.default = router;

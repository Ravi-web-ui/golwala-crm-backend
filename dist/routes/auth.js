"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Email and password required" });
        return;
    }
    try {
        const user = await db_1.prisma.adminUser.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, user.password);
        if (!valid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// Setup first super admin (run once)
router.post("/setup", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existing = await db_1.prisma.adminUser.findFirst();
        if (existing) {
            res.status(400).json({ error: "Admin already exists" });
            return;
        }
        const hash = await bcrypt_1.default.hash(password, 10);
        await db_1.prisma.adminUser.create({ data: { name, email, password: hash, role: "super_admin" } });
        res.json({ message: "Admin created successfully" });
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
exports.default = router;

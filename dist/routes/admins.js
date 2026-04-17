"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const notify_1 = require("../services/notify");
const router = (0, express_1.Router)();
// Get all admins with permissions + program assignments
router.get("/", auth_1.auth, auth_1.superOnly, async (_req, res) => {
    const admins = await db_1.prisma.adminUser.findMany({
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, permissions: true, programAssignments: true },
        orderBy: { createdAt: "desc" },
    });
    res.json(admins);
});
// Get current user's permissions
router.get("/my-permissions", auth_1.auth, async (req, res) => {
    if (req.user?.role === "super_admin") {
        res.json({ canViewLeads: true, canEditLeads: true, canDeleteLeads: true, canExportLeads: true, canViewReports: true, canManageFilters: true });
        return;
    }
    const perm = await db_1.prisma.permission.findUnique({ where: { adminId: req.user.id } });
    res.json(perm || { canViewLeads: true, canEditLeads: true, canDeleteLeads: false, canExportLeads: false, canViewReports: true, canManageFilters: true });
});
// Create sub-admin / manager
router.post("/", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: "Name, email and password required" });
        return;
    }
    try {
        const existing = await db_1.prisma.adminUser.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: "Email already exists" });
            return;
        }
        const hash = await bcrypt_1.default.hash(password, 10);
        const validRole = ["super_admin", "admin", "manager"].includes(role) ? role : "admin";
        const newAdmin = await db_1.prisma.adminUser.create({ data: { name, email, password: hash, role: validRole, phone: phone || null } });
        await db_1.prisma.permission.create({
            data: {
                adminId: newAdmin.id,
                canViewLeads: true, canEditLeads: true, canDeleteLeads: false,
                canExportLeads: validRole === "admin", canViewReports: true, canManageFilters: true,
            },
        });
        // WhatsApp notifications (non-blocking)
        (async () => {
            try {
                const superAdmin = await db_1.prisma.adminUser.findFirst({ where: { role: "super_admin" }, select: { phone: true, email: true } });
                await (0, notify_1.notifyNewAdmin)({ name, email, role: validRole, phone: phone || null }, superAdmin?.phone || null, superAdmin?.email || null);
            }
            catch { }
        })();
        res.json({ message: "User created successfully" });
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// Update permissions
router.patch("/:id/permissions", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const adminId = parseInt(req.params.id);
    const { canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters } = req.body;
    try {
        await db_1.prisma.permission.upsert({
            where: { adminId },
            update: { canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters },
            create: { adminId, canViewLeads, canEditLeads, canDeleteLeads, canExportLeads, canViewReports, canManageFilters },
        });
        res.json({ message: "Permissions updated" });
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// Update program assignments for a manager/admin
router.put("/:id/programs", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const adminId = parseInt(req.params.id);
    const { programs } = req.body; // string[]
    if (!Array.isArray(programs)) {
        res.status(400).json({ error: "programs array required" });
        return;
    }
    // Replace all assignments
    await db_1.prisma.programAssignment.deleteMany({ where: { adminId } });
    if (programs.length > 0) {
        await db_1.prisma.programAssignment.createMany({
            data: programs.map((p) => ({ adminId, program: p })),
            skipDuplicates: true,
        });
    }
    res.json({ message: "Programs updated" });
});
// Update own profile (name / email / phone) — must be before /:id
router.patch("/me", auth_1.auth, async (req, res) => {
    const { name, email, phone } = req.body;
    if (!name && !email && phone === undefined) {
        res.status(400).json({ error: "Nothing to update" });
        return;
    }
    const data = {};
    if (name)
        data.name = name;
    if (phone !== undefined)
        data.phone = phone || null;
    if (email) {
        const conflict = await db_1.prisma.adminUser.findFirst({ where: { email, NOT: { id: req.user.id } } });
        if (conflict) {
            res.status(400).json({ error: "Email already in use" });
            return;
        }
        data.email = email;
    }
    const updated = await db_1.prisma.adminUser.update({ where: { id: req.user.id }, data, select: { id: true, name: true, email: true, phone: true, role: true } });
    res.json({ message: "Profile updated", user: updated });
});
// Update admin name/role
router.patch("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { name, role } = req.body;
    const data = {};
    if (name)
        data.name = name;
    if (role && ["super_admin", "admin", "manager"].includes(role))
        data.role = role;
    await db_1.prisma.adminUser.update({ where: { id: parseInt(req.params.id) }, data });
    res.json({ message: "Updated" });
});
// Change own password
router.post("/change-password", auth_1.auth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        res.status(400).json({ error: "Both fields required" });
        return;
    }
    if (new_password.length < 6) {
        res.status(400).json({ error: "Min 6 characters" });
        return;
    }
    const user = await db_1.prisma.adminUser.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt_1.default.compare(current_password, user.password);
    if (!valid) {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
    }
    const hash = await bcrypt_1.default.hash(new_password, 10);
    await db_1.prisma.adminUser.update({ where: { id: req.user.id }, data: { password: hash } });
    res.json({ message: "Password changed successfully" });
});
// Super admin reset password
router.post("/:id/reset-password", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
        res.status(400).json({ error: "Min 6 characters" });
        return;
    }
    const hash = await bcrypt_1.default.hash(new_password, 10);
    await db_1.prisma.adminUser.update({ where: { id: parseInt(req.params.id) }, data: { password: hash } });
    res.json({ message: "Password reset successfully" });
});
// Delete admin
router.delete("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
        res.status(400).json({ error: "Cannot delete yourself" });
        return;
    }
    await db_1.prisma.adminUser.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
});
exports.default = router;

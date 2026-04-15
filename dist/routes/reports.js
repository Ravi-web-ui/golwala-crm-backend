"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Agent performance report
router.get("/agent-performance", auth_1.auth, async (req, res) => {
    const admins = await db_1.prisma.adminUser.findMany({
        where: req.user?.role === "super_admin" ? {} : { id: req.user.id },
        select: {
            id: true, name: true, role: true,
            leads: {
                select: { status: true },
            },
            followUps: { select: { status: true } },
            callLogs: { select: { outcome: true } },
        },
    });
    const report = admins.map(a => {
        const total = a.leads.length;
        const byStatus = a.leads.reduce((acc, l) => {
            acc[l.status] = (acc[l.status] || 0) + 1;
            return acc;
        }, {});
        const followUpsDone = a.followUps.filter(f => f.status === "done").length;
        const followUpsPending = a.followUps.filter(f => f.status === "pending").length;
        const callsMade = a.callLogs.length;
        const callsAnswered = a.callLogs.filter(c => c.outcome === "answered").length;
        const admitted = byStatus["admitted"] || 0;
        const conversionRate = total > 0 ? Math.round((admitted / total) * 100) : 0;
        return {
            id: a.id, name: a.name, role: a.role,
            totalLeads: total, byStatus,
            followUpsDone, followUpsPending,
            callsMade, callsAnswered,
            conversionRate,
        };
    });
    res.json(report);
});
// Export leads as CSV
router.get("/export-csv", auth_1.auth, async (req, res) => {
    const where = {};
    if (req.user?.role === "manager")
        where.assignedTo = req.user.id;
    const leads = await db_1.prisma.lead.findMany({
        where,
        include: { assignedAdmin: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
    });
    const headers = ["ID", "Name", "Phone", "Email", "City", "State", "Program Level", "Program", "Source", "Status", "Assigned To", "UTM Source", "UTM Medium", "UTM Campaign", "UTM Name", "Form Source", "Created At"];
    const rows = leads.map(l => [
        l.id, l.fullName, `${l.countryCode}${l.phone}`, l.email,
        l.city || "", l.state || "", l.programLevel || "", l.program || "",
        l.hearAbout || "", l.status, l.assignedAdmin?.name || "",
        l.utmSource || "", l.utmMedium || "", l.utmCampaign || "", l.utmName || "",
        l.formSource || "", new Date(l.createdAt).toLocaleString("en-IN"),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${Date.now()}.csv"`);
    res.send(csv);
});
exports.default = router;

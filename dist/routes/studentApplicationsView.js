"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// HTML page to view student applications
router.get("/view", async (req, res) => {
    try {
        const applications = await db_1.prisma.studentAdmission.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Applications - Golwala College</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header h1 { font-size: 24px; color: #1f2937; margin-bottom: 8px; }
        .header p { color: #6b7280; font-size: 14px; }
        .stats { display: flex; gap: 20px; margin-top: 16px; }
        .stat { background: #f3f4f6; padding: 12px 20px; border-radius: 6px; }
        .stat-value { font-size: 24px; font-weight: 700; color: #dc2626; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .table-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f9fafb; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
        td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #1f2937; }
        tr:hover { background: #f9fafb; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .badge-new { background: #dbeafe; color: #1e40af; }
        .badge-reviewed { background: #fef3c7; color: #92400e; }
        .badge-approved { background: #d1fae5; color: #065f46; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
        .badge-pending { background: #f3f4f6; color: #4b5563; }
        .app-no { font-family: monospace; font-weight: 600; color: #dc2626; }
        .back-btn { display: inline-block; padding: 8px 16px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; margin-bottom: 20px; }
        .back-btn:hover { background: #b91c1c; }
        .empty { text-align: center; padding: 60px 20px; color: #6b7280; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <a href="https://admin.golwalacollege.edu.in" class="back-btn">← Back to Admin Panel</a>
        
        <div class="header">
            <h1>Student Applications</h1>
            <p>Admission applications for Academic Year 2026-2027</p>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${applications.length}</div>
                    <div class="stat-label">Total Applications</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${applications.filter((a) => a.status === 'new').length}</div>
                    <div class="stat-label">New</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${applications.filter((a) => a.status === 'approved').length}</div>
                    <div class="stat-label">Approved</div>
                </div>
            </div>
        </div>

        <div class="table-container">
            ${applications.length === 0 ? `
                <div class="empty">
                    <div class="empty-icon">📋</div>
                    <h3>No Applications Yet</h3>
                    <p>Student applications will appear here once submitted</p>
                </div>
            ` : `
                <table>
                    <thead>
                        <tr>
                            <th>Application #</th>
                            <th>Student Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Stream</th>
                            <th>Status</th>
                            <th>Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${applications.map((app) => `
                            <tr>
                                <td><span class="app-no">${app.applicationNo}</span></td>
                                <td>${app.firstName} ${app.surname}</td>
                                <td>${app.studentEmail}</td>
                                <td>${app.studentMobile}</td>
                                <td>${app.stream}</td>
                                <td><span class="badge badge-${app.status}">${app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span></td>
                                <td>${new Date(app.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    </div>
</body>
</html>
    `;
        res.send(html);
    }
    catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).send("Error loading applications");
    }
});
exports.default = router;

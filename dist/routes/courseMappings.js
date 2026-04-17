"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/course-mappings?instituteId=1&branchId=2
router.get("/", auth_1.auth, async (req, res) => {
    const { instituteId, branchId } = req.query;
    const where = {};
    if (branchId)
        where.branchId = parseInt(branchId);
    else if (instituteId) {
        // filter by all branches of this institute
        const branches = await db_1.prisma.branch.findMany({
            where: { instituteId: parseInt(instituteId) },
            select: { id: true },
        });
        where.branchId = { in: branches.map(b => b.id) };
    }
    const mappings = await db_1.prisma.courseMapping.findMany({
        where,
        orderBy: { ourCourseName: "asc" },
        include: {
            branch: {
                include: { institute: true },
            },
        },
    });
    res.json(mappings);
});
// POST /api/course-mappings
router.post("/", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const { branchId, ourCourseName, externalCourseName, genioCourseId, genioSpecializationId } = req.body;
    if (!branchId || !ourCourseName?.trim() || !externalCourseName?.trim()) {
        res.status(400).json({ error: "branchId, ourCourseName and externalCourseName are required" });
        return;
    }
    try {
        const mapping = await db_1.prisma.courseMapping.create({
            data: {
                branchId: parseInt(branchId),
                ourCourseName: ourCourseName.trim(),
                externalCourseName: externalCourseName.trim(),
                genioCourseId: genioCourseId ? parseInt(genioCourseId) : null,
                genioSpecializationId: genioSpecializationId ? parseInt(genioSpecializationId) : null,
            },
            include: { branch: { include: { institute: true } } },
        });
        res.json(mapping);
    }
    catch {
        res.status(500).json({ error: "Server error" });
    }
});
// PATCH /api/course-mappings/:id
router.patch("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    const id = parseInt(req.params.id);
    const { ourCourseName, externalCourseName, genioCourseId, genioSpecializationId } = req.body;
    const data = {};
    if (ourCourseName?.trim())
        data.ourCourseName = ourCourseName.trim();
    if (externalCourseName?.trim())
        data.externalCourseName = externalCourseName.trim();
    if (genioCourseId !== undefined)
        data.genioCourseId = genioCourseId ? parseInt(genioCourseId) : null;
    if (genioSpecializationId !== undefined)
        data.genioSpecializationId = genioSpecializationId ? parseInt(genioSpecializationId) : null;
    const mapping = await db_1.prisma.courseMapping.update({ where: { id }, data });
    res.json(mapping);
});
// DELETE /api/course-mappings/:id
router.delete("/:id", auth_1.auth, auth_1.superOnly, async (req, res) => {
    await db_1.prisma.courseMapping.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const UPLOAD_DIR = path_1.default.join(process.cwd(), "src", "uploads", "activities");
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if ([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error("Invalid file type. Allowed: JPG, JPEG, PNG, WEBP, MP4, WEBM"));
    },
});
// GET /api/website-activities?section=rozgar_mela — public
router.get("/", async (req, res) => {
    const { section } = req.query;
    try {
        const where = section ? { section: String(section) } : {};
        const items = await db_1.prisma.activityItem.findMany({ where, orderBy: { sortOrder: "asc" } });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/website-activities — admin only
router.post("/", auth_1.auth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "File required" });
        return;
    }
    const { section, heading } = req.body;
    if (!section || !heading) {
        res.status(400).json({ error: "section and heading are required" });
        return;
    }
    const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);
    if (isImage && req.file.size > 5 * 1024 * 1024) {
        fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: "Image exceeds 5MB limit" });
        return;
    }
    if (isVideo && req.file.size > 50 * 1024 * 1024) {
        fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: "Video exceeds 50MB limit" });
        return;
    }
    try {
        const maxOrder = await db_1.prisma.activityItem.aggregate({ where: { section }, _max: { sortOrder: true } });
        const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        const item = await db_1.prisma.activityItem.create({
            data: {
                section,
                type: isImage ? "image" : "video",
                url: `/uploads/activities/${req.file.filename}`,
                filename: req.file.filename,
                heading,
                sortOrder: nextOrder,
            },
        });
        res.status(201).json(item);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/website-activities/:id — admin only (edit heading)
router.put("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { heading } = req.body;
    try {
        const item = await db_1.prisma.activityItem.update({ where: { id }, data: { heading } });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/website-activities/:id — admin only
router.delete("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const item = await db_1.prisma.activityItem.findUnique({ where: { id } });
        if (!item) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        const filePath = path_1.default.join(UPLOAD_DIR, item.filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        await db_1.prisma.activityItem.delete({ where: { id } });
        res.json({ message: "Deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PATCH /api/website-activities/reorder — admin only
router.patch("/reorder", auth_1.auth, async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        res.status(400).json({ error: "items array required" });
        return;
    }
    try {
        await Promise.all(items.map(({ id, sortOrder }) => db_1.prisma.activityItem.update({ where: { id }, data: { sortOrder } })));
        res.json({ message: "Reordered" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PATCH /api/website-activities/:id/move-to-experiential — admin only
router.patch("/:id/move-to-experiential", auth_1.auth, async (req, res) => {
    const id = parseInt(String(req.params.id));
    try {
        const activity = await db_1.prisma.activityItem.findUnique({ where: { id } });
        if (!activity) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        // Copy file to gallery uploads folder
        const srcPath = path_1.default.join(UPLOAD_DIR, activity.filename);
        const galleryDir = path_1.default.join(process.cwd(), "src", "uploads", "gallery");
        if (!fs_1.default.existsSync(galleryDir))
            fs_1.default.mkdirSync(galleryDir, { recursive: true });
        const destPath = path_1.default.join(galleryDir, activity.filename);
        if (fs_1.default.existsSync(srcPath)) {
            fs_1.default.copyFileSync(srcPath, destPath);
        }
        else {
            res.status(404).json({ error: "Source file not found" });
            return;
        }
        // Get next sort order
        const maxOrder = await db_1.prisma.galleryMedia.aggregate({ where: { section: "experiential" }, _max: { sortOrder: true } });
        const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        // Create gallery entry
        await db_1.prisma.galleryMedia.create({
            data: {
                type: activity.type,
                filename: activity.filename,
                url: `/uploads/gallery/${activity.filename}`,
                size: fs_1.default.existsSync(destPath) ? fs_1.default.statSync(destPath).size : 0,
                mimeType: activity.type === "image" ? "image/jpeg" : "video/mp4", // approximation
                section: "experiential",
                sortOrder: nextOrder,
            },
        });
        // Delete the activity item
        await db_1.prisma.activityItem.delete({ where: { id } });
        res.json({ message: "Moved to Experiential Learning" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;

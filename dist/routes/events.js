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
const UPLOAD_DIR = path_1.default.join(process.cwd(), "src", "uploads", "events");
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (allowed.includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error("Only JPG, JPEG, PNG, WEBP allowed for event images"));
    },
});
// GET /api/events — public (shows active only); admin sees all via ?all=true
router.get("/", async (req, res) => {
    const showAll = req.query.all === "true";
    try {
        const where = showAll ? {} : { status: "active" };
        const events = await db_1.prisma.event.findMany({ where, orderBy: { eventDate: "asc" } });
        res.json(events);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/events — admin only
router.post("/", auth_1.auth, upload.single("image"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "Event image required" });
        return;
    }
    const { title, eventDate } = req.body;
    if (!title || !eventDate) {
        res.status(400).json({ error: "title and eventDate required" });
        return;
    }
    try {
        const event = await db_1.prisma.event.create({
            data: {
                title,
                imageUrl: `/uploads/events/${req.file.filename}`,
                eventDate: new Date(eventDate),
                status: "active",
            },
        });
        res.status(201).json(event);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/events/:id — admin only (edit title/date)
router.put("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, eventDate } = req.body;
    try {
        const event = await db_1.prisma.event.update({
            where: { id },
            data: { title, eventDate: eventDate ? new Date(eventDate) : undefined },
        });
        res.json(event);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/events/:id — admin only
router.delete("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const event = await db_1.prisma.event.findUnique({ where: { id } });
        if (!event) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        // Delete image file
        const filename = path_1.default.basename(event.imageUrl);
        const filePath = path_1.default.join(UPLOAD_DIR, filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        await db_1.prisma.event.delete({ where: { id } });
        res.json({ message: "Deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PATCH /api/events/:id/action — admin only: hide | delete | move_to_gallery
router.patch("/:id/action", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { action } = req.body; // "hide" | "delete" | "move_to_gallery"
    try {
        const event = await db_1.prisma.event.findUnique({ where: { id } });
        if (!event) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        if (action === "hide") {
            const updated = await db_1.prisma.event.update({ where: { id }, data: { status: "hidden" } });
            res.json(updated);
        }
        else if (action === "delete") {
            const filename = path_1.default.basename(event.imageUrl);
            const filePath = path_1.default.join(UPLOAD_DIR, filename);
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
            await db_1.prisma.event.delete({ where: { id } });
            res.json({ message: "Deleted" });
        }
        else if (action === "move_to_gallery") {
            // Copy image to gallery uploads folder
            const filename = path_1.default.basename(event.imageUrl);
            const srcPath = path_1.default.join(UPLOAD_DIR, filename);
            const galleryDir = path_1.default.join(process.cwd(), "src", "uploads", "gallery");
            const destPath = path_1.default.join(galleryDir, filename);
            if (fs_1.default.existsSync(srcPath))
                fs_1.default.copyFileSync(srcPath, destPath);
            const maxOrder = await db_1.prisma.galleryMedia.aggregate({ where: { section: "experiential" }, _max: { sortOrder: true } });
            const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
            await db_1.prisma.galleryMedia.create({
                data: {
                    type: "image",
                    filename,
                    url: `/uploads/gallery/${filename}`,
                    size: fs_1.default.existsSync(destPath) ? fs_1.default.statSync(destPath).size : 0,
                    mimeType: "image/jpeg",
                    section: "experiential",
                    sortOrder: nextOrder,
                },
            });
            const updated = await db_1.prisma.event.update({ where: { id }, data: { status: "hidden", movedToGallery: true } });
            res.json(updated);
        }
        else {
            res.status(400).json({ error: "Invalid action. Use: hide | delete | move_to_gallery" });
        }
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;

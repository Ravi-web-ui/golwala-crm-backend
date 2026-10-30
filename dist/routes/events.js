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
    const { title, eventDate, startDate, endDate, imageUrl: bodyImageUrl } = req.body;
    const targetDate = startDate || eventDate;
    if (!title || !targetDate) {
        res.status(400).json({ error: "Title and Event Date are required" });
        return;
    }
    let finalImageUrl = "";
    if (req.file) {
        finalImageUrl = `/uploads/events/${req.file.filename}`;
    }
    else if (bodyImageUrl) {
        finalImageUrl = bodyImageUrl;
    }
    else {
        res.status(400).json({ error: "Event image is required (select from gallery or upload from PC)" });
        return;
    }
    try {
        const event = await db_1.prisma.event.create({
            data: {
                title,
                imageUrl: finalImageUrl,
                eventDate: new Date(targetDate),
                endDate: endDate ? new Date(endDate) : null,
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
    const id = parseInt(String(req.params.id), 10);
    const { title, eventDate, startDate, endDate, imageUrl } = req.body;
    const targetDate = startDate || eventDate;
    try {
        const event = await db_1.prisma.event.update({
            where: { id },
            data: {
                title: title !== undefined ? title : undefined,
                imageUrl: imageUrl !== undefined ? imageUrl : undefined,
                eventDate: targetDate ? new Date(targetDate) : undefined,
                endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
            },
        });
        res.json(event);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/events/:id — admin only
router.delete("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
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
    const id = parseInt(String(req.params.id), 10);
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
            const filename = path_1.default.basename(event.imageUrl);
            const galleryDir = path_1.default.join(process.cwd(), "src", "uploads", "gallery");
            if (!fs_1.default.existsSync(galleryDir))
                fs_1.default.mkdirSync(galleryDir, { recursive: true });
            // Check possible local file paths
            let foundSrcPath = null;
            const possiblePaths = [
                path_1.default.join(UPLOAD_DIR, filename),
                path_1.default.join(process.cwd(), "src", "uploads", "events", filename),
                path_1.default.join(process.cwd(), "src", "uploads", "gallery", filename),
                path_1.default.join(process.cwd(), "src", "uploads", "media", "2026", "10", filename),
                path_1.default.join(process.cwd(), "..", "public", "images", "experiential", filename),
            ];
            for (const p of possiblePaths) {
                if (fs_1.default.existsSync(p)) {
                    foundSrcPath = p;
                    break;
                }
            }
            let finalUrl = event.imageUrl;
            let finalSize = 0;
            const destFilename = `${Date.now()}-${filename}`;
            const destPath = path_1.default.join(galleryDir, destFilename);
            if (foundSrcPath) {
                fs_1.default.copyFileSync(foundSrcPath, destPath);
                finalUrl = `/uploads/gallery/${destFilename}`;
                finalSize = fs_1.default.statSync(destPath).size;
            }
            // Shift all existing experiential items by +1 so the new item goes to position 0 (first)
            await db_1.prisma.galleryMedia.updateMany({
                where: { section: "experiential" },
                data: { sortOrder: { increment: 1 } },
            });
            await db_1.prisma.galleryMedia.create({
                data: {
                    type: "image",
                    filename,
                    url: finalUrl,
                    size: finalSize,
                    mimeType: "image/jpeg",
                    section: "experiential",
                    sortOrder: 0,
                },
            });
            // Keep event active - do NOT hide or delete from Upcoming Events!
            const updated = await db_1.prisma.event.update({ where: { id }, data: { movedToGallery: true } });
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

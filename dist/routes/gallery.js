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
const UPLOAD_DIR = path_1.default.join(process.cwd(), "src", "uploads", "gallery");
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_VIDEO_SIZE },
    fileFilter: (_req, file, cb) => {
        if ([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, JPEG, PNG, WEBP, MP4, WEBM`));
        }
    },
});
// GET /api/gallery?section=experiential
router.get("/", async (req, res) => {
    const { section } = req.query;
    try {
        const where = section ? { section: String(section) } : {};
        const items = await db_1.prisma.galleryMedia.findMany({ where, orderBy: { sortOrder: "asc" } });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/gallery/upload — admin only
router.post("/upload", auth_1.auth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    const { section } = req.body;
    if (!section) {
        res.status(400).json({ error: "section is required" });
        return;
    }
    const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);
    // Enforce per-type size limits
    if (isImage && req.file.size > MAX_IMAGE_SIZE) {
        fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: "Image exceeds 5MB limit" });
        return;
    }
    if (isVideo && req.file.size > MAX_VIDEO_SIZE) {
        fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: "Video exceeds 50MB limit" });
        return;
    }
    try {
        const maxOrder = await db_1.prisma.galleryMedia.aggregate({ where: { section }, _max: { sortOrder: true } });
        const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        const media = await db_1.prisma.galleryMedia.create({
            data: {
                type: isImage ? "image" : "video",
                filename: req.file.filename,
                url: `/uploads/gallery/${req.file.filename}`,
                size: req.file.size,
                mimeType: req.file.mimetype,
                section,
                sortOrder: nextOrder,
            },
        });
        res.status(201).json(media);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/gallery/:id — admin only
router.delete("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const media = await db_1.prisma.galleryMedia.findUnique({ where: { id } });
        if (!media) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        const filePath = path_1.default.join(UPLOAD_DIR, media.filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        await db_1.prisma.galleryMedia.delete({ where: { id } });
        res.json({ message: "Deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PATCH /api/gallery/reorder — admin only
router.patch("/reorder", auth_1.auth, async (req, res) => {
    // body: { items: [{ id, sortOrder }] }
    const { items } = req.body;
    if (!Array.isArray(items)) {
        res.status(400).json({ error: "items array required" });
        return;
    }
    try {
        await Promise.all(items.map(({ id, sortOrder }) => db_1.prisma.galleryMedia.update({ where: { id }, data: { sortOrder } })));
        res.json({ message: "Reordered" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/gallery/from-media — admin only (add media library item to gallery)
router.post("/from-media", auth_1.auth, async (req, res) => {
    const { mediaLibraryId, section } = req.body;
    if (!mediaLibraryId || !section) {
        res.status(400).json({ error: "mediaLibraryId and section are required" });
        return;
    }
    try {
        // Get media library item
        const media = await db_1.prisma.mediaLibrary.findUnique({ where: { id: mediaLibraryId } });
        if (!media) {
            res.status(404).json({ error: "Media not found" });
            return;
        }
        // Copy file from media library to gallery folder
        const urlParts = media.url.split("/");
        const filename = urlParts[urlParts.length - 1];
        const month = urlParts[urlParts.length - 2];
        const year = urlParts[urlParts.length - 3];
        const srcPath = path_1.default.join(process.cwd(), "src", "uploads", "media", year, month, filename);
        const destFilename = `${Date.now()}-${filename}`;
        const destPath = path_1.default.join(UPLOAD_DIR, destFilename);
        if (fs_1.default.existsSync(srcPath)) {
            fs_1.default.copyFileSync(srcPath, destPath);
        }
        else {
            res.status(404).json({ error: "Source file not found" });
            return;
        }
        // Get next sort order
        const maxOrder = await db_1.prisma.galleryMedia.aggregate({ where: { section }, _max: { sortOrder: true } });
        const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        // Create gallery entry
        const galleryItem = await db_1.prisma.galleryMedia.create({
            data: {
                type: media.type,
                filename: destFilename,
                url: `/uploads/gallery/${destFilename}`,
                size: fs_1.default.statSync(destPath).size,
                mimeType: media.mimeType,
                section,
                sortOrder: nextOrder,
            },
        });
        // Increment usage count
        await db_1.prisma.mediaLibrary.update({
            where: { id: mediaLibraryId },
            data: { usageCount: { increment: 1 } },
        });
        res.status(201).json(galleryItem);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/gallery/:id — admin only (update metadata)
router.put("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(String(req.params.id));
    const { filename } = req.body;
    try {
        const item = await db_1.prisma.galleryMedia.update({
            where: { id },
            data: { filename: filename !== undefined ? filename : undefined },
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;

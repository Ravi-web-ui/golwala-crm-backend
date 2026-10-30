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
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const file_type_1 = __importDefault(require("file-type"));
// Set ffmpeg path
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
const router = (0, express_1.Router)();
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
// Create base uploads folder
const UPLOADS_BASE = path_1.default.join(process.cwd(), "src", "uploads", "media");
if (!fs_1.default.existsSync(UPLOADS_BASE))
    fs_1.default.mkdirSync(UPLOADS_BASE, { recursive: true });
// Dynamic folder creation based on year/month
function getUploadDir() {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const dir = path_1.default.join(UPLOADS_BASE, year, month);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadDir()),
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
// Helper function to generate video thumbnail
async function generateThumbnail(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(videoPath)
            .screenshots({
            timestamps: ['1'],
            filename: path_1.default.basename(outputPath),
            folder: path_1.default.dirname(outputPath),
            size: '640x?'
        })
            .on('end', () => resolve())
            .on('error', (err) => {
            // Fallback: try first frame
            (0, fluent_ffmpeg_1.default)(videoPath)
                .screenshots({
                timestamps: ['00:00:00.001'],
                filename: path_1.default.basename(outputPath),
                folder: path_1.default.dirname(outputPath),
                size: '640x?'
            })
                .on('end', () => resolve())
                .on('error', (fallbackErr) => reject(fallbackErr));
        });
    });
}
// POST /api/media-library/upload — admin only
router.post("/upload", auth_1.auth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    const { title, altText, caption, tags } = req.body;
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
    // Verify file magic number matches declared MIME type
    try {
        const detectedType = await file_type_1.default.fromFile(req.file.path);
        if (!detectedType) {
            fs_1.default.unlinkSync(req.file.path);
            res.status(400).json({ error: "Unable to verify file type" });
            return;
        }
        const allowedMimes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
        if (!allowedMimes.includes(detectedType.mime)) {
            fs_1.default.unlinkSync(req.file.path);
            res.status(400).json({ error: `Invalid file type detected: ${detectedType.mime}. Allowed: JPG, PNG, WEBP, MP4, WEBM` });
            return;
        }
        // Verify claimed MIME matches detected MIME (prevent spoofing)
        if (req.file.mimetype !== detectedType.mime) {
            fs_1.default.unlinkSync(req.file.path);
            res.status(400).json({ error: "File type mismatch detected. File content does not match declared type." });
            return;
        }
    }
    catch (verifyErr) {
        fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: "File verification failed" });
        return;
    }
    try {
        let thumbnailUrl = null;
        // Generate thumbnail for videos
        if (isVideo) {
            const thumbnailFilename = req.file.filename.replace(path_1.default.extname(req.file.filename), "-thumb.jpg");
            const thumbnailPath = path_1.default.join(path_1.default.dirname(req.file.path), thumbnailFilename);
            try {
                await generateThumbnail(req.file.path, thumbnailPath);
                const now = new Date();
                const year = now.getFullYear().toString();
                const month = (now.getMonth() + 1).toString().padStart(2, "0");
                thumbnailUrl = `/uploads/media/${year}/${month}/${thumbnailFilename}`;
            }
            catch (err) {
                console.error("Thumbnail generation failed:", err);
                // Continue without thumbnail
            }
        }
        // Get relative URL path
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const fileUrl = `/uploads/media/${year}/${month}/${req.file.filename}`;
        const media = await db_1.prisma.mediaLibrary.create({
            data: {
                type: isImage ? "image" : "video",
                filename: req.file.filename,
                url: fileUrl,
                thumbnailUrl,
                size: req.file.size,
                mimeType: req.file.mimetype,
                title: title || null,
                altText: altText || null,
                caption: caption || null,
                uploadedBy: req.user?.id || null,
                tags: tags || null,
                usageCount: 0,
            },
        });
        res.status(201).json(media);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/media-library — public/auth-optional
router.get("/", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search;
    const type = req.query.type;
    const tagsParam = req.query.tags;
    try {
        const where = {};
        if (search) {
            where.OR = [
                { filename: { contains: search } },
                { title: { contains: search } },
            ];
        }
        if (type && (type === "image" || type === "video")) {
            where.type = type;
        }
        if (tagsParam) {
            const tagList = tagsParam.split(",").map(t => t.trim());
            // Tags stored as JSON string, use contains for simple matching
            where.tags = { contains: tagList[0] }; // Simple implementation
        }
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            db_1.prisma.mediaLibrary.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db_1.prisma.mediaLibrary.count({ where }),
        ]);
        res.json({ items, total, page, limit });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/media-library/:id — public/auth-optional
router.get("/:id", async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    try {
        const media = await db_1.prisma.mediaLibrary.findUnique({ where: { id } });
        if (!media) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        res.json(media);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/media-library/:id — admin only
router.put("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const { title, altText, caption, tags } = req.body;
    try {
        const media = await db_1.prisma.mediaLibrary.update({
            where: { id },
            data: {
                title: title !== undefined ? title : undefined,
                altText: altText !== undefined ? altText : undefined,
                caption: caption !== undefined ? caption : undefined,
                tags: tags !== undefined ? tags : undefined,
            },
        });
        res.json(media);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/media-library/:id — admin only
router.delete("/:id", auth_1.auth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    try {
        const media = await db_1.prisma.mediaLibrary.findUnique({ where: { id } });
        if (!media) {
            res.status(404).json({ error: "Not found" });
            return;
        }
        // Extract year/month/filename from URL and validate
        const urlParts = media.url.split("/");
        const filename = urlParts[urlParts.length - 1];
        const month = urlParts[urlParts.length - 2];
        const year = urlParts[urlParts.length - 3];
        // Validate filename (prevent path traversal)
        const safeFilenamePattern = /^[a-zA-Z0-9._-]+$/;
        if (!safeFilenamePattern.test(filename)) {
            res.status(400).json({ error: "Invalid filename format" });
            return;
        }
        // Validate year and month are numeric
        if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
            res.status(400).json({ error: "Invalid path format" });
            return;
        }
        // Delete main file
        const filePath = path_1.default.join(UPLOADS_BASE, year, month, filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
        // Delete thumbnail if exists
        if (media.thumbnailUrl) {
            const thumbUrlParts = media.thumbnailUrl.split("/");
            const thumbFilename = thumbUrlParts[thumbUrlParts.length - 1];
            // Validate thumbnail filename
            if (!safeFilenamePattern.test(thumbFilename)) {
                // Skip thumbnail deletion if invalid, but continue with record deletion
                console.warn(`Invalid thumbnail filename detected: ${thumbFilename}`);
            }
            else {
                const thumbPath = path_1.default.join(UPLOADS_BASE, year, month, thumbFilename);
                if (fs_1.default.existsSync(thumbPath))
                    fs_1.default.unlinkSync(thumbPath);
            }
        }
        await db_1.prisma.mediaLibrary.delete({ where: { id } });
        res.json({ message: "Deleted" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;

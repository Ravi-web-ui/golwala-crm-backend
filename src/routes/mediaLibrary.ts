import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { auth, AuthRequest } from "../middleware/auth";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { fileTypeFromFile } from "file-type";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const router = Router();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Create base uploads folder
const UPLOADS_BASE = path.join(process.cwd(), "src", "uploads", "media");
if (!fs.existsSync(UPLOADS_BASE)) fs.mkdirSync(UPLOADS_BASE, { recursive: true });

// Dynamic folder creation based on year/month
function getUploadDir(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const dir = path.join(UPLOADS_BASE, year, month);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadDir()),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    if ([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, JPEG, PNG, WEBP, MP4, WEBM`));
    }
  },
});

// Helper function to generate video thumbnail
async function generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '640x?'
      })
      .on('end', () => resolve())
      .on('error', (err) => {
        // Fallback: try first frame
        ffmpeg(videoPath)
          .screenshots({
            timestamps: ['00:00:00.001'],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: '640x?'
          })
          .on('end', () => resolve())
          .on('error', (fallbackErr) => reject(fallbackErr));
      });
  });
}

// POST /api/media-library/upload — admin only
router.post("/upload", auth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  
  const { title, altText, caption, tags } = req.body;
  const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);

  // Enforce per-type size limits
  if (isImage && req.file.size > MAX_IMAGE_SIZE) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Image exceeds 5MB limit" });
    return;
  }
  if (isVideo && req.file.size > MAX_VIDEO_SIZE) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Video exceeds 50MB limit" });
    return;
  }

  // Verify file magic number matches declared MIME type
  try {
    const detectedType = await fileTypeFromFile(req.file.path);
    if (!detectedType) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "Unable to verify file type" });
      return;
    }
    
    const allowedMimes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
    if (!allowedMimes.includes(detectedType.mime)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: `Invalid file type detected: ${detectedType.mime}. Allowed: JPG, PNG, WEBP, MP4, WEBM` });
      return;
    }

    // Verify claimed MIME matches detected MIME (prevent spoofing)
    if (req.file.mimetype !== detectedType.mime) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "File type mismatch detected. File content does not match declared type." });
      return;
    }
  } catch (verifyErr) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "File verification failed" });
    return;
  }

  try {
    let thumbnailUrl: string | null = null;

    // Generate thumbnail for videos
    if (isVideo) {
      const thumbnailFilename = req.file.filename.replace(path.extname(req.file.filename), "-thumb.jpg");
      const thumbnailPath = path.join(path.dirname(req.file.path), thumbnailFilename);
      
      try {
        await generateThumbnail(req.file.path, thumbnailPath);
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        thumbnailUrl = `/uploads/media/${year}/${month}/${thumbnailFilename}`;
      } catch (err) {
        console.error("Thumbnail generation failed:", err);
        // Continue without thumbnail
      }
    }

    // Get relative URL path
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const fileUrl = `/uploads/media/${year}/${month}/${req.file.filename}`;

    const media = await prisma.mediaLibrary.create({
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/media-library — public/auth-optional
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const type = req.query.type as string;
  const tagsParam = req.query.tags as string;

  try {
    const where: any = {};

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
      prisma.mediaLibrary.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.mediaLibrary.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/media-library/:id — public/auth-optional
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const media = await prisma.mediaLibrary.findUnique({ where: { id } });
    if (!media) { res.status(404).json({ error: "Not found" }); return; }
    res.json(media);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/media-library/:id — admin only
router.put("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { title, altText, caption, tags } = req.body;
  
  try {
    const media = await prisma.mediaLibrary.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        altText: altText !== undefined ? altText : undefined,
        caption: caption !== undefined ? caption : undefined,
        tags: tags !== undefined ? tags : undefined,
      },
    });
    res.json(media);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/media-library/:id — admin only
router.delete("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  
  try {
    const media = await prisma.mediaLibrary.findUnique({ where: { id } });
    if (!media) { res.status(404).json({ error: "Not found" }); return; }

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
    const filePath = path.join(UPLOADS_BASE, year, month, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Delete thumbnail if exists
    if (media.thumbnailUrl) {
      const thumbUrlParts = media.thumbnailUrl.split("/");
      const thumbFilename = thumbUrlParts[thumbUrlParts.length - 1];
      
      // Validate thumbnail filename
      if (!safeFilenamePattern.test(thumbFilename)) {
        // Skip thumbnail deletion if invalid, but continue with record deletion
        console.warn(`Invalid thumbnail filename detected: ${thumbFilename}`);
      } else {
        const thumbPath = path.join(UPLOADS_BASE, year, month, thumbFilename);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }
    }

    await prisma.mediaLibrary.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { auth } from "../middleware/auth";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "src", "uploads", "activities");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Allowed: JPG, JPEG, PNG, WEBP, MP4, WEBM"));
  },
});

// GET /api/website-activities?section=rozgar_mela — public
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { section } = req.query;
  try {
    const where = section ? { section: String(section) } : {};
    const items = await prisma.activityItem.findMany({ where, orderBy: { sortOrder: "asc" } });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/website-activities — admin only
router.post("/", auth, upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "File required" }); return; }
  const { section, heading } = req.body;
  if (!section || !heading) { res.status(400).json({ error: "section and heading are required" }); return; }

  const isImage = ALLOWED_IMAGE_TYPES.includes(req.file.mimetype);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);

  if (isImage && req.file.size > 5 * 1024 * 1024) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Image exceeds 5MB limit" });
    return;
  }
  if (isVideo && req.file.size > 50 * 1024 * 1024) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "Video exceeds 50MB limit" });
    return;
  }

  try {
    const maxOrder = await prisma.activityItem.aggregate({ where: { section }, _max: { sortOrder: true } });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const item = await prisma.activityItem.create({
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/website-activities/:id — admin only (edit heading)
router.put("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { heading } = req.body;
  try {
    const item = await prisma.activityItem.update({ where: { id }, data: { heading } });
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/website-activities/:id — admin only
router.delete("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const item = await prisma.activityItem.findUnique({ where: { id } });
    if (!item) { res.status(404).json({ error: "Not found" }); return; }
    const filePath = path.join(UPLOAD_DIR, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.activityItem.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/website-activities/reorder — admin only
router.patch("/reorder", auth, async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body;
  if (!Array.isArray(items)) { res.status(400).json({ error: "items array required" }); return; }
  try {
    await Promise.all(
      items.map(({ id, sortOrder }: { id: number; sortOrder: number }) =>
        prisma.activityItem.update({ where: { id }, data: { sortOrder } })
      )
    );
    res.json({ message: "Reordered" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/website-activities/:id/move-to-experiential — admin only
router.patch("/:id/move-to-experiential", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id));
  
  try {
    const activity = await prisma.activityItem.findUnique({ where: { id } });
    if (!activity) { res.status(404).json({ error: "Not found" }); return; }

    // Copy file to gallery uploads folder
    const srcPath = path.join(UPLOAD_DIR, activity.filename);
    const galleryDir = path.join(process.cwd(), "src", "uploads", "gallery");
    if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
    const destPath = path.join(galleryDir, activity.filename);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      res.status(404).json({ error: "Source file not found" });
      return;
    }

    // Get next sort order
    const maxOrder = await prisma.galleryMedia.aggregate({ where: { section: "experiential" }, _max: { sortOrder: true } });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    // Create gallery entry
    await prisma.galleryMedia.create({
      data: {
        type: activity.type,
        filename: activity.filename,
        url: `/uploads/gallery/${activity.filename}`,
        size: fs.existsSync(destPath) ? fs.statSync(destPath).size : 0,
        mimeType: activity.type === "image" ? "image/jpeg" : "video/mp4", // approximation
        section: "experiential",
        sortOrder: nextOrder,
      },
    });

    // Delete the activity item
    await prisma.activityItem.delete({ where: { id } });

    res.json({ message: "Moved to Experiential Learning" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

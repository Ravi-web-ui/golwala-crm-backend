import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { auth } from "../middleware/auth";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "src", "uploads", "events");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, JPEG, PNG, WEBP allowed for event images"));
  },
});

// GET /api/events — public (shows active only); admin sees all via ?all=true
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const showAll = req.query.all === "true";
  try {
    const where = showAll ? {} : { status: "active" };
    const events = await prisma.event.findMany({ where, orderBy: { eventDate: "asc" } });
    res.json(events);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/events — admin only
router.post("/", auth, upload.single("image"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "Event image required" }); return; }
  const { title, eventDate } = req.body;
  if (!title || !eventDate) { res.status(400).json({ error: "title and eventDate required" }); return; }
  try {
    const event = await prisma.event.create({
      data: {
        title,
        imageUrl: `/uploads/events/${req.file.filename}`,
        eventDate: new Date(eventDate),
        status: "active",
      },
    });
    res.status(201).json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/events/:id — admin only (edit title/date)
router.put("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { title, eventDate } = req.body;
  try {
    const event = await prisma.event.update({
      where: { id },
      data: { title, eventDate: eventDate ? new Date(eventDate) : undefined },
    });
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/events/:id — admin only
router.delete("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) { res.status(404).json({ error: "Not found" }); return; }
    // Delete image file
    const filename = path.basename(event.imageUrl);
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.event.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/events/:id/action — admin only: hide | delete | move_to_gallery
router.patch("/:id/action", auth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { action } = req.body; // "hide" | "delete" | "move_to_gallery"
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) { res.status(404).json({ error: "Not found" }); return; }

    if (action === "hide") {
      const updated = await prisma.event.update({ where: { id }, data: { status: "hidden" } });
      res.json(updated);
    } else if (action === "delete") {
      const filename = path.basename(event.imageUrl);
      const filePath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await prisma.event.delete({ where: { id } });
      res.json({ message: "Deleted" });
    } else if (action === "move_to_gallery") {
      // Copy image to gallery uploads folder
      const filename = path.basename(event.imageUrl);
      const srcPath = path.join(UPLOAD_DIR, filename);
      const galleryDir = path.join(process.cwd(), "src", "uploads", "gallery");
      const destPath = path.join(galleryDir, filename);
      if (fs.existsSync(srcPath)) fs.copyFileSync(srcPath, destPath);

      const maxOrder = await prisma.galleryMedia.aggregate({ where: { section: "experiential" }, _max: { sortOrder: true } });
      const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

      await prisma.galleryMedia.create({
        data: {
          type: "image",
          filename,
          url: `/uploads/gallery/${filename}`,
          size: fs.existsSync(destPath) ? fs.statSync(destPath).size : 0,
          mimeType: "image/jpeg",
          section: "experiential",
          sortOrder: nextOrder,
        },
      });
      const updated = await prisma.event.update({ where: { id }, data: { status: "hidden", movedToGallery: true } });
      res.json(updated);
    } else {
      res.status(400).json({ error: "Invalid action. Use: hide | delete | move_to_gallery" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

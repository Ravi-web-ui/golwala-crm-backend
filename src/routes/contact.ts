import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { auth, superOnly, AuthRequest } from "../middleware/auth";

const router = Router();

// Public - submit contact form
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { full_name, phone, email, program, message } = req.body;
  if (!full_name || !email || !message) {
    res.status(400).json({ error: "Name, email and message required" }); return;
  }
  try {
    await prisma.contactInquiry.create({
      data: { fullName: full_name, phone, email, program, message },
    });
    res.json({ message: "Inquiry submitted successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin - get all inquiries
router.get("/", auth, async (_req: AuthRequest, res: Response): Promise<void> => {
  const inquiries = await prisma.contactInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(inquiries);
});

// Admin - update status
router.patch("/:id", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  await prisma.contactInquiry.update({
    where: { id: parseInt(req.params.id as string) },
    data: { status },
  });
  res.json({ message: "Updated" });
});

// Admin - delete
router.delete("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.contactInquiry.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

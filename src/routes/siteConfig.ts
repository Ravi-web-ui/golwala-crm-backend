import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { auth } from "../middleware/auth";

const router = Router();

// GET /api/site-config — public (website reads this)
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.siteConfig.findUnique({ where: { key: "topbar" } });
    if (!config) {
      config = await prisma.siteConfig.create({
        data: { key: "topbar", topbarText: "Admissions Open for 2027-28", buttonName: "Apply Now", buttonLink: "/admissions", enabled: true },
      });
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/site-config/topbar — admin only
router.put("/topbar", auth, async (req: Request, res: Response): Promise<void> => {
  const { topbarText, buttonName, buttonLink, enabled } = req.body;
  try {
    const config = await prisma.siteConfig.upsert({
      where: { key: "topbar" },
      update: { topbarText, buttonName, buttonLink, enabled },
      create: { key: "topbar", topbarText, buttonName, buttonLink, enabled: enabled ?? true },
    });
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

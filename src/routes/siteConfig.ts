import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { auth } from "../middleware/auth";

const router = Router();

function parseTopbar(config: any) {
  let items: Array<{ id: string; text: string; buttonName?: string; buttonLink?: string }> = [];
  let speed = "fast";

  if (config?.topbarText) {
    const raw = String(config.topbarText).trim();
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.items)) items = parsed.items;
          if (parsed.speed) speed = parsed.speed;
        }
      } catch {
        // Fallback to plain text
      }
    }

    if (items.length === 0 && raw) {
      items = [
        {
          id: "1",
          text: raw,
          buttonName: config.buttonName || "",
          buttonLink: config.buttonLink || "",
        },
      ];
    }
  }

  // Normalize items
  items = items
    .map((item, idx) => ({
      id: item.id || String(idx + 1),
      text: (item.text || "").trim(),
      buttonName: (item.buttonName || "").trim(),
      buttonLink: (item.buttonLink || "").trim(),
    }))
    .filter((item) => item.text.length > 0);

  return { items, speed };
}

// GET /api/site-config — public (website reads this)
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.siteConfig.findUnique({ where: { key: "topbar" } });
    if (!config) {
      const defaultItems = [
        { id: "1", text: "ADMISSIONS OPEN FOR 2027-28", buttonName: "Apply Now", buttonLink: "/admissions" },
        { id: "2", text: "DIWALI FESTIVE COMPETITION 2026", buttonName: "Register Now", buttonLink: "/upcoming-events" },
        { id: "3", text: "DIYA DONATION DRIVE", buttonName: "Explore", buttonLink: "/activities" },
      ];
      config = await prisma.siteConfig.create({
        data: {
          key: "topbar",
          topbarText: JSON.stringify({ items: defaultItems, speed: "fast" }),
          buttonName: "Apply Now",
          buttonLink: "/admissions",
          enabled: true,
        },
      });
    }

    const { items, speed } = parseTopbar(config);

    // Add cache-control headers to prevent stale caching
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json({
      ...config,
      items,
      speed,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/site-config/topbar — admin only
router.put("/topbar", auth, async (req: Request, res: Response): Promise<void> => {
  const { topbarText, buttonName, buttonLink, enabled, items, speed } = req.body;
  try {
    let finalTopbarText = topbarText;
    let finalButtonName = buttonName;
    let finalButtonLink = buttonLink;

    if (Array.isArray(items)) {
      finalTopbarText = JSON.stringify({ items, speed: speed || "fast" });
      const firstWithButton = items.find((i: any) => i.buttonName && i.buttonLink) || items[0];
      finalButtonName = firstWithButton?.buttonName || "";
      finalButtonLink = firstWithButton?.buttonLink || "";
    }

    const config = await prisma.siteConfig.upsert({
      where: { key: "topbar" },
      update: {
        topbarText: finalTopbarText,
        buttonName: finalButtonName,
        buttonLink: finalButtonLink,
        enabled: enabled ?? true,
      },
      create: {
        key: "topbar",
        topbarText: finalTopbarText,
        buttonName: finalButtonName,
        buttonLink: finalButtonLink,
        enabled: enabled ?? true,
      },
    });

    const parsed = parseTopbar(config);

    res.json({
      ...config,
      items: parsed.items,
      speed: parsed.speed,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

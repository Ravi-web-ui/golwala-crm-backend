import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { auth } from "../middleware/auth";
import sanitizeHtml from "sanitize-html";

const router = Router();

// HTML Sanitizer configuration for CKEditor output
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "b", "i", "strong", "em", "u", "s", "strike",
    "ul", "ol", "li",
    "a", "img", "blockquote",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "figure", "figcaption", "div", "span",
    "hr", "br", "code", "pre", "sub", "sup"
  ],
  allowedAttributes: {
    "*": ["class", "style", "title", "dir", "lang", "id", "data-*"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    table: ["border", "cellpadding", "cellspacing", "width"],
    th: ["colspan", "rowspan", "scope", "align", "valign"],
    td: ["colspan", "rowspan", "align", "valign"]
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  transformTags: {
    a: (tagName, attribs) => {
      // Ensure external links have safe rel
      const rel = attribs.target === "_blank" ? "noopener noreferrer" : attribs.rel;
      return {
        tagName,
        attribs: { ...attribs, ...(rel ? { rel } : {}) }
      };
    }
  }
};

// Helper: Slugify title
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Helper: Ensure unique slug
async function generateUniqueSlug(title: string, currentId?: number): Promise<string> {
  const baseSlug = slugify(title) || "article";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (!existing || (currentId && existing.id === currentId)) {
      return slug;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

function normalizeSection(sec?: any): string | undefined {
  if (!sec || typeof sec !== "string" || sec === "all") return undefined;
  if (sec === "experiential-learning") return "experiential";
  if (sec === "upcoming-events") return "events";
  return sec;
}

// GET /api/articles - List articles with filtering
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { section, status, search, all, limit, offset } = req.query;

    const where: any = {};

    const cleanSection = normalizeSection(section);
    if (cleanSection) {
      where.section = cleanSection;
    }

    // Default to published articles unless admin requests ?all=true or specific status
    if (all === "true") {
      if (status && typeof status === "string") {
        where.status = status;
      }
    } else {
      where.status = status && typeof status === "string" ? status : "published";
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.trim();
      where.OR = [
        { title: { contains: q } },
        { shortDescription: { contains: q } },
      ];
    }

    const take = limit ? parseInt(String(limit), 10) : undefined;
    const skip = offset ? parseInt(String(offset), 10) : undefined;

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take,
        skip,
      }),
      prisma.article.count({ where }),
    ]);

    res.json({ items, total });
  } catch (e: any) {
    console.error("GET /api/articles error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch articles" });
  }
});

// GET /api/articles/slug/:slug - Get single article by slug + related articles
router.get("/slug/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params.slug as string;
    const article = await prisma.article.findUnique({
      where: { slug },
    });

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    // Fetch related articles (same section, published, excluding current)
    const related = await prisma.article.findMany({
      where: {
        section: article.section,
        status: "published",
        NOT: { id: article.id },
      },
      take: 4,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        featuredImage: true,
        section: true,
        publishedAt: true,
        eventDate: true,
      },
    });

    res.json({ article, related });
  } catch (e: any) {
    console.error("GET /api/articles/slug/:slug error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch article" });
  }
});

// GET /api/articles/id/:id - Get single article by ID (admin editing)
router.get("/id/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json(article);
  } catch (e: any) {
    console.error("GET /api/articles/id/:id error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch article" });
  }
});

// GET /api/articles/:id (numeric alias)
router.get("/:id([0-9]+)", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json(article);
  } catch (e: any) {
    console.error("GET /api/articles/:id error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch article" });
  }
});

// POST /api/articles - Create new article (Admin only)
router.post("/", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      slug: customSlug,
      section,
      featuredImage,
      shortDescription,
      content,
      additionalImages,
      publishedAt,
      eventDate,
      endDate,
      sortOrder,
      status,
      seoTitle,
      seoDescription,
      seoKeywords,
      canonicalUrl,
      schemaCode,
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: "Article Title is required" });
      return;
    }
    const finalSection = normalizeSection(section) || section;
    if (!finalSection || !["experiential", "events", "activities"].includes(finalSection)) {
      res.status(400).json({ error: "Valid section (experiential, events, activities) is required" });
      return;
    }
    if (!featuredImage) {
      res.status(400).json({ error: "Featured Image is required" });
      return;
    }

    // Determine unique slug
    const finalSlug = customSlug && customSlug.trim()
      ? await generateUniqueSlug(customSlug.trim())
      : await generateUniqueSlug(title.trim());

    // Sanitize content
    const sanitizedContent = content ? sanitizeHtml(content, sanitizeOptions) : "";

    // Determine sort order
    let finalSortOrder = typeof sortOrder === "number" ? sortOrder : 0;
    if (sortOrder === undefined) {
      const maxOrder = await prisma.article.aggregate({
        where: { section },
        _max: { sortOrder: true },
      });
      finalSortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    const articleStatus = status || "published";
    const articlePublishedAt = publishedAt
      ? new Date(publishedAt)
      : articleStatus === "published"
      ? new Date()
      : null;

    const newArticle = await prisma.article.create({
      data: {
        title: title.trim(),
        slug: finalSlug,
        section,
        featuredImage,
        shortDescription: shortDescription?.trim() || null,
        content: sanitizedContent,
        additionalImages: additionalImages || [],
        publishedAt: articlePublishedAt,
        eventDate: eventDate ? new Date(eventDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sortOrder: finalSortOrder,
        status: articleStatus,
        seoTitle: seoTitle?.trim() || null,
        seoDescription: seoDescription?.trim() || null,
        seoKeywords: seoKeywords?.trim() || null,
        canonicalUrl: canonicalUrl?.trim() || null,
        schemaCode: schemaCode?.trim() || null,
      },
    });

    res.status(201).json(newArticle);
  } catch (e: any) {
    console.error("POST /api/articles error:", e);
    res.status(500).json({ error: e.message || "Failed to create article" });
  }
});

// PUT /api/articles/:id - Update existing article (Admin only)
router.put("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const {
      title,
      slug: customSlug,
      section,
      featuredImage,
      shortDescription,
      content,
      additionalImages,
      publishedAt,
      eventDate,
      endDate,
      sortOrder,
      status,
      seoTitle,
      seoDescription,
      seoKeywords,
      canonicalUrl,
      schemaCode,
    } = req.body;

    let finalSlug = existing.slug;
    if (customSlug && customSlug.trim() !== existing.slug) {
      finalSlug = await generateUniqueSlug(customSlug.trim(), id);
    } else if (title && title.trim() !== existing.title && (!customSlug || customSlug === existing.slug)) {
      // If title changed and slug wasn't custom-locked, keep slug or regenerate if requested
    }

    const sanitizedContent = content !== undefined ? sanitizeHtml(content, sanitizeOptions) : existing.content;

    let finalPublishedAt = existing.publishedAt;
    if (publishedAt !== undefined) {
      finalPublishedAt = publishedAt ? new Date(publishedAt) : null;
    } else if (status === "published" && !existing.publishedAt) {
      finalPublishedAt = new Date();
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        slug: finalSlug,
        section: section !== undefined ? section : existing.section,
        featuredImage: featuredImage !== undefined ? featuredImage : existing.featuredImage,
        shortDescription: shortDescription !== undefined ? (shortDescription?.trim() || null) : existing.shortDescription,
        content: sanitizedContent,
        additionalImages: additionalImages !== undefined ? additionalImages : existing.additionalImages,
        publishedAt: finalPublishedAt,
        eventDate: eventDate !== undefined ? (eventDate ? new Date(eventDate) : null) : existing.eventDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        status: status !== undefined ? status : existing.status,
        seoTitle: seoTitle !== undefined ? (seoTitle?.trim() || null) : (existing as any).seoTitle,
        seoDescription: seoDescription !== undefined ? (seoDescription?.trim() || null) : (existing as any).seoDescription,
        seoKeywords: seoKeywords !== undefined ? (seoKeywords?.trim() || null) : (existing as any).seoKeywords,
        canonicalUrl: canonicalUrl !== undefined ? (canonicalUrl?.trim() || null) : (existing as any).canonicalUrl,
        schemaCode: schemaCode !== undefined ? (schemaCode?.trim() || null) : (existing as any).schemaCode,
      },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("PUT /api/articles/:id error:", e);
    res.status(500).json({ error: e.message || "Failed to update article" });
  }
});

// DELETE /api/articles/:id - Delete article (Admin only)
router.delete("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    await prisma.article.delete({ where: { id } });
    res.json({ message: "Article deleted successfully", id });
  } catch (e: any) {
    console.error("DELETE /api/articles/:id error:", e);
    res.status(500).json({ error: e.message || "Failed to delete article" });
  }
});

// PATCH /api/articles/:id/status - Update status (draft/published/unpublished)
router.patch("/:id/status", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { status } = req.body;

    if (!["draft", "published", "unpublished"].includes(status)) {
      res.status(400).json({ error: "Status must be 'draft', 'published', or 'unpublished'" });
      return;
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const publishedAt = status === "published" && !existing.publishedAt ? new Date() : existing.publishedAt;

    const updated = await prisma.article.update({
      where: { id },
      data: { status, publishedAt },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("PATCH /api/articles/:id/status error:", e);
    res.status(500).json({ error: e.message || "Failed to update status" });
  }
});

// PATCH /api/articles/:id/move-section - Move article to another section (e.g. to Experiential Learning)
// Without creating duplicates!
router.patch("/:id/move-section", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { targetSection } = req.body;

    const cleanTarget = normalizeSection(targetSection) || targetSection;
    if (!cleanTarget || !["experiential", "events", "activities"].includes(cleanTarget)) {
      res.status(400).json({ error: "Valid targetSection (experiential, events, activities) is required" });
      return;
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    if (existing.section === targetSection) {
      res.json(existing);
      return;
    }

    // Place at beginning of target section (sortOrder = 0), shift others
    await prisma.article.updateMany({
      where: { section: targetSection },
      data: { sortOrder: { increment: 1 } },
    });

    const updated = await prisma.article.update({
      where: { id },
      data: {
        section: targetSection,
        sortOrder: 0,
      },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("PATCH /api/articles/:id/move-section error:", e);
    res.status(500).json({ error: e.message || "Failed to move article section" });
  }
});

// PATCH /api/articles/reorder - Bulk reorder articles within a section
router.patch("/reorder", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body; // Array of { id: number, sortOrder: number }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.article.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    res.json({ message: "Articles reordered successfully" });
  } catch (e: any) {
    console.error("PATCH /api/articles/reorder error:", e);
    res.status(500).json({ error: e.message || "Failed to reorder articles" });
  }
});

export default router;

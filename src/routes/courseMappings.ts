import { Router, Response } from "express";
import { prisma } from "../db";
import { auth, superOnly, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/course-mappings?instituteId=1&branchId=2
router.get("/", auth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { instituteId, branchId } = req.query;

  const where: any = {};
  if (branchId)    where.branchId = parseInt(branchId as string);
  else if (instituteId) {
    // filter by all branches of this institute
    const branches = await prisma.branch.findMany({
      where: { instituteId: parseInt(instituteId as string) },
      select: { id: true },
    });
    where.branchId = { in: branches.map(b => b.id) };
  }

  const mappings = await prisma.courseMapping.findMany({
    where,
    orderBy: { ourCourseName: "asc" },
    include: {
      branch: {
        include: { institute: true },
      },
    },
  });
  res.json(mappings);
});

// POST /api/course-mappings
router.post("/", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { branchId, ourCourseName, externalCourseName, genioCourseId, genioSpecializationId } = req.body;
  if (!branchId || !ourCourseName?.trim() || !externalCourseName?.trim()) {
    res.status(400).json({ error: "branchId, ourCourseName and externalCourseName are required" });
    return;
  }
  try {
    const mapping = await prisma.courseMapping.create({
      data: {
        branchId:              parseInt(branchId),
        ourCourseName:         ourCourseName.trim(),
        externalCourseName:    externalCourseName.trim(),
        genioCourseId:         genioCourseId         ? parseInt(genioCourseId)         : null,
        genioSpecializationId: genioSpecializationId ? parseInt(genioSpecializationId) : null,
      },
      include: { branch: { include: { institute: true } } },
    });
    res.json(mapping);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/course-mappings/:id
router.patch("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const { ourCourseName, externalCourseName, genioCourseId, genioSpecializationId } = req.body;
  const data: any = {};
  if (ourCourseName?.trim())      data.ourCourseName         = ourCourseName.trim();
  if (externalCourseName?.trim()) data.externalCourseName    = externalCourseName.trim();
  if (genioCourseId !== undefined)         data.genioCourseId         = genioCourseId         ? parseInt(genioCourseId)         : null;
  if (genioSpecializationId !== undefined) data.genioSpecializationId = genioSpecializationId ? parseInt(genioSpecializationId) : null;
  const mapping = await prisma.courseMapping.update({ where: { id }, data });
  res.json(mapping);
});

// DELETE /api/course-mappings/:id
router.delete("/:id", auth, superOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.courseMapping.delete({ where: { id: parseInt(req.params.id as string) } });
  res.json({ message: "Deleted" });
});

export default router;

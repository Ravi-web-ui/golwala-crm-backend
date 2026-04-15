import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const router = Router();

// Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "8h" }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Setup first super admin (run once)
router.post("/setup", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;
  try {
    const existing = await prisma.adminUser.findFirst();
    if (existing) { res.status(400).json({ error: "Admin already exists" }); return; }
    const hash = await bcrypt.hash(password, 10);
    await prisma.adminUser.create({ data: { name, email, password: hash, role: "super_admin" } });
    res.json({ message: "Admin created successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  id: number;
  email: string;
  role: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const superOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "super_admin") { res.status(403).json({ error: "Super admin only" }); return; }
  next();
};

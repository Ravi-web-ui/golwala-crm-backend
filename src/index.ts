import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";

import authRoutes       from "./routes/auth";
import leadsRoutes      from "./routes/leads";
import adminsRoutes     from "./routes/admins";
import filtersRoutes    from "./routes/filters";
import activitiesRoutes from "./routes/activities";
import followupsRoutes  from "./routes/followups";
import calllogsRoutes   from "./routes/calllogs";
import reportsRoutes    from "./routes/reports";
import statusesRoutes   from "./routes/statuses";
import contactRoutes    from "./routes/contact";
import { prisma }       from "./db";

// ── Error log setup ───────────────────────────────────────────────────────────
const LOG_DIR  = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "error.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeLog(level: string, msg: string, meta?: any) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  }) + "\n";
  fs.appendFileSync(LOG_FILE, line);
  if (level === "ERROR") console.error(`[${level}] ${msg}`, meta || "");
  else console.log(`[${level}] ${msg}`);
}

process.on("uncaughtException",  (err) => writeLog("ERROR", "Uncaught Exception",  { message: err.message, stack: err.stack }));
process.on("unhandledRejection", (err: any) => writeLog("ERROR", "Unhandled Rejection", { message: err?.message, stack: err?.stack }));

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
const isProd = process.env.NODE_ENV === "production";

// Gzip compress all responses
app.use(compression());

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isProd) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  "https://golwalacollege.edu.in",
  "https://www.golwalacollege.edu.in",
  "https://admin.golwalacollege.edu.in",
  // dev
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:5173",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    writeLog("WARN", `CORS blocked: ${origin}`);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

// Request logger (prod: file only, dev: console)
app.use((req, _res, next) => {
  if (isProd) writeLog("INFO", `${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Rate limiters
const formLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  message: { error: "Too many submissions, try later" } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { error: "Too many login attempts" } });

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",       loginLimiter, authRoutes);
app.use("/api/leads", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") return formLimiter(req, res, next);
  next();
}, leadsRoutes);
app.use("/api/admins",     adminsRoutes);
app.use("/api/filters",    filtersRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/followups",  followupsRoutes);
app.use("/api/calllogs",   calllogsRoutes);
app.use("/api/reports",    reportsRoutes);
app.use("/api/statuses",   statusesRoutes);
app.use("/api/contact",    contactRoutes);

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected", ts: new Date().toISOString() });
  } catch (e: any) {
    writeLog("ERROR", "Health check DB failed", { message: e.message });
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  writeLog("ERROR", `${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ error: isProd ? "Internal server error" : err.message });
});

// ── Seed default statuses ─────────────────────────────────────────────────────
const seedStatuses = async () => {
  try {
    const count = await prisma.leadStatusConfig.count();
    if (count > 0) return;
    await prisma.leadStatusConfig.createMany({
      data: [
        { label:"New Leads",      value:"new",            color:"#3b82f6", stage:"initial", order:0, isDefault:true },
        { label:"Contacted",      value:"contacted",      color:"#eab308", stage:"active",  order:0, isDefault:true },
        { label:"Interested",     value:"interested",     color:"#22c55e", stage:"active",  order:1, isDefault:true },
        { label:"Cold",           value:"cold",           color:"#06b6d4", stage:"active",  order:2, isDefault:true },
        { label:"Warm",           value:"warm",           color:"#f97316", stage:"active",  order:3, isDefault:true },
        { label:"Admitted",       value:"admitted",       color:"#a855f7", stage:"closed",  order:0, isDefault:true },
        { label:"Not Interested", value:"not_interested", color:"#ef4444", stage:"closed",  order:1, isDefault:true },
        { label:"Lost",           value:"lost",           color:"#6b7280", stage:"closed",  order:2, isDefault:true },
      ],
    });
    writeLog("INFO", "Default statuses seeded");
  } catch (e: any) {
    writeLog("ERROR", "Seed failed", { message: e.message });
  }
};

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000");
app.listen(PORT, "0.0.0.0", async () => {
  writeLog("INFO", `Server running on port ${PORT} [${isProd ? "production" : "development"}]`);
  await seedStatuses();
});

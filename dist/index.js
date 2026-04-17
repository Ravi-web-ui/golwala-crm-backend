"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const leads_1 = __importDefault(require("./routes/leads"));
const admins_1 = __importDefault(require("./routes/admins"));
const filters_1 = __importDefault(require("./routes/filters"));
const activities_1 = __importDefault(require("./routes/activities"));
const followups_1 = __importDefault(require("./routes/followups"));
const calllogs_1 = __importDefault(require("./routes/calllogs"));
const reports_1 = __importDefault(require("./routes/reports"));
const statuses_1 = __importDefault(require("./routes/statuses"));
const contact_1 = __importDefault(require("./routes/contact"));
const institutes_1 = __importDefault(require("./routes/institutes"));
const courseMappings_1 = __importDefault(require("./routes/courseMappings"));
const db_1 = require("./db");
// ── Error log setup ───────────────────────────────────────────────────────────
const LOG_DIR = path_1.default.join(process.cwd(), "logs");
const LOG_FILE = path_1.default.join(LOG_DIR, "error.log");
if (!fs_1.default.existsSync(LOG_DIR))
    fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
function writeLog(level, msg, meta) {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        msg,
        ...(meta ? { meta } : {}),
    }) + "\n";
    fs_1.default.appendFileSync(LOG_FILE, line);
    if (level === "ERROR")
        console.error(`[${level}] ${msg}`, meta || "");
    else
        console.log(`[${level}] ${msg}`);
}
process.on("uncaughtException", (err) => {
    writeLog("ERROR", "Uncaught Exception", { message: err.message, stack: err.stack });
    // Must exit on Prisma engine panic — Passenger will restart the process
    process.exit(1);
});
process.on("unhandledRejection", (err) => {
    writeLog("ERROR", "Unhandled Rejection", { message: err?.message, stack: err?.stack });
    process.exit(1);
});
// ── App ───────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
const isProd = process.env.NODE_ENV === "production";
// Gzip compress all responses
app.use((0, compression_1.default)());
// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (isProd)
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
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
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin))
            return cb(null, true);
        writeLog("WARN", `CORS blocked: ${origin}`);
        cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
// Request logger (prod: file only, dev: console)
app.use((req, _res, next) => {
    if (isProd)
        writeLog("INFO", `${req.method} ${req.path}`, { ip: req.ip });
    next();
});
// Rate limiters
const formLimiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many submissions, try later" } });
const loginLimiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many login attempts" } });
// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", loginLimiter, auth_1.default);
app.use("/api/leads", (req, res, next) => {
    if (req.method === "POST" && req.path === "/")
        return formLimiter(req, res, next);
    next();
}, leads_1.default);
app.use("/api/admins", admins_1.default);
app.use("/api/filters", filters_1.default);
app.use("/api/activities", activities_1.default);
app.use("/api/followups", followups_1.default);
app.use("/api/calllogs", calllogs_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/statuses", statuses_1.default);
app.use("/api/contact", contact_1.default);
app.use("/api/institutes", institutes_1.default);
app.use("/api/course-mappings", courseMappings_1.default);
// Health check
app.get("/api/health", async (_req, res) => {
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        res.json({ status: "ok", db: "connected", ts: new Date().toISOString(), v: "2" });
    }
    catch (e) {
        writeLog("ERROR", "Health check DB failed", { message: e.message });
        res.status(500).json({ status: "error", db: "disconnected", v: "2", err: e.message?.slice(0, 100) });
    }
});
// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
// Global error handler
app.use((err, req, res, _next) => {
    writeLog("ERROR", `${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
    res.status(err.status || 500).json({ error: isProd ? "Internal server error" : err.message });
});
// ── Seed default statuses ─────────────────────────────────────────────────────
const seedStatuses = async () => {
    try {
        const count = await db_1.prisma.leadStatusConfig.count();
        if (count > 0)
            return;
        await db_1.prisma.leadStatusConfig.createMany({
            data: [
                { label: "New Leads", value: "new", color: "#3b82f6", stage: "initial", order: 0, isDefault: true },
                { label: "Contacted", value: "contacted", color: "#eab308", stage: "active", order: 0, isDefault: true },
                { label: "Interested", value: "interested", color: "#22c55e", stage: "active", order: 1, isDefault: true },
                { label: "Cold", value: "cold", color: "#06b6d4", stage: "active", order: 2, isDefault: true },
                { label: "Warm", value: "warm", color: "#f97316", stage: "active", order: 3, isDefault: true },
                { label: "Admitted", value: "admitted", color: "#a855f7", stage: "closed", order: 0, isDefault: true },
                { label: "Not Interested", value: "not_interested", color: "#ef4444", stage: "closed", order: 1, isDefault: true },
                { label: "Lost", value: "lost", color: "#6b7280", stage: "closed", order: 2, isDefault: true },
            ],
        });
        writeLog("INFO", "Default statuses seeded");
    }
    catch (e) {
        writeLog("ERROR", "Seed failed", { message: e.message });
    }
};
// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000");
app.listen(PORT, "0.0.0.0", async () => {
    writeLog("INFO", `Server running on port ${PORT} [${isProd ? "production" : "development"}]`);
    // Connect explicitly so engine initialises before first request
    try {
        await db_1.prisma.$connect();
        writeLog("INFO", "DB connected");
    }
    catch (e) {
        writeLog("ERROR", "DB connect failed", { message: e.message });
    }
    await seedStatuses();
});

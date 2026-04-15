"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const isProd = process.env.NODE_ENV === "production";
exports.prisma = new client_1.PrismaClient({
    // Log slow queries in production for monitoring
    log: isProd
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [],
});
// Warn on slow queries (>2s)
if (isProd) {
    exports.prisma.$on("warn", (e) => console.warn("[Prisma WARN]", e.message));
    exports.prisma.$on("error", (e) => console.error("[Prisma ERROR]", e.message));
}

import { PrismaClient } from "@prisma/client";

const isProd = process.env.NODE_ENV === "production";

export const prisma = new PrismaClient({
  // Log slow queries in production for monitoring
  log: isProd
    ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
    : [],
});

// Warn on slow queries (>2s)
if (isProd) {
  (prisma as any).$on("warn",  (e: any) => console.warn("[Prisma WARN]",  e.message));
  (prisma as any).$on("error", (e: any) => console.error("[Prisma ERROR]", e.message));
}

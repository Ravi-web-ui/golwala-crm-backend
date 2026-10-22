import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Static images from ExperientialLearning.tsx STATIC_FALLBACK array
const STATIC_IMAGES = [
  "Experiential39.jpeg",
  "Experiential40.jpeg",
  "Experiential33.jpeg",
  "Experiential30.jpeg",
  "Experiential1.jpg",
  "Experiential2.jpg",
  "Experiential3.jpeg",
  "Experiential4.jpg",
  "Experiential5.jpeg",
  "Experiential6.jpeg",
  "Experiential7.jpeg",
  "Experiential8.jpeg",
  "Experiential9.jpeg",
  "Experiential10.jpeg",
  "Experiential11.jpeg",
  "Experiential12.jpeg",
  "Experiential13.jpeg",
  "Experiential14.jpeg",
  "Experiential15.jpeg",
  "Experiential16.jpeg",
  "Experiential17.png",
  "Experiential18.jpeg",
  "Experiential19.jpeg",
  "Experiential20.jpeg",
  "Experiential21.jpg",
  "Experiential22.jpg",
  "Experiential23.jpeg",
  "Experiential24.jpeg",
  "Experiential25.jpeg",
  "Experiential26.jpeg",
  "Experiential27.jpeg",
  "Experiential28.jpeg",
  "Experiential29.jpeg",
];

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

async function migrateImages() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const sourceDirRoot = path.resolve(__dirname, "..", "..", "..", "public", "images", "experiential");
  const uploadsDirRoot = path.resolve(__dirname, "..", "src", "uploads", "media", String(year), month);

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(uploadsDirRoot)) {
    fs.mkdirSync(uploadsDirRoot, { recursive: true });
    console.log(`✓ Created directory: ${uploadsDirRoot}`);
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < STATIC_IMAGES.length; i++) {
    const filename = STATIC_IMAGES[i];
    const sourcePath = path.join(sourceDirRoot, filename);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠ Skipped (not found): ${filename}`);
      skippedCount++;
      continue;
    }

    try {
      // Get file stats
      const stats = fs.statSync(sourcePath);
      const size = stats.size;
      const mimeType = getMimeType(filename);

      // Copy file to uploads directory
      const destPath = path.join(uploadsDirRoot, filename);
      fs.copyFileSync(sourcePath, destPath);

      // Insert record into database
      const url = `/uploads/media/${year}/${month}/${filename}`;
      await prisma.galleryMedia.create({
        data: {
          type: "image",
          filename,
          url,
          size,
          mimeType,
          section: "experiential",
          sortOrder: i,
        },
      });

      console.log(`✓ Migrated [${i + 1}/${STATIC_IMAGES.length}]: ${filename} (${size} bytes)`);
      migratedCount++;
    } catch (error) {
      console.error(`✗ Failed to migrate ${filename}:`, error);
      skippedCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Migration complete!`);
  console.log(`  Successfully migrated: ${migratedCount} images`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Destination: ${uploadsDirRoot}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

migrateImages().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

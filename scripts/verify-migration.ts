import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  const count = await prisma.galleryMedia.count({
    where: { section: "experiential" },
  });
  
  console.log(`Total records in gallery_media with section='experiential': ${count}`);
  
  if (count > 0) {
    const sample = await prisma.galleryMedia.findMany({
      where: { section: "experiential" },
      take: 3,
      orderBy: { sortOrder: "asc" },
    });
    
    console.log("\nSample records:");
    sample.forEach((item) => {
      console.log(`  - ${item.filename} (${item.type}, ${item.size} bytes, sortOrder: ${item.sortOrder})`);
    });
  }
  
  await prisma.$disconnect();
}

verify().catch(console.error);

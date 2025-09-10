import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.studentCase.createMany({
    data: [
      { studentName: "Alice", category: "IT Help", status: "QUEUED" },
      { studentName: "Bob", category: "Academic Support", status: "QUEUED" },
      { studentName: "Chloe", category: "Administrative", status: "QUEUED" },
    ],
    skipDuplicates: true,
  });
  console.log("Seeded student cases");
}
main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
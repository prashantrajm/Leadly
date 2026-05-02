import { getPrisma } from "../src/lib/prisma.js";

const prisma = getPrisma(process.env.DATABASE_URL!);

async function main() {
  console.log("Seeding…");

  await prisma.user.upsert({
    where: { email: "owner@leady.local" },
    update: {},
    create: {
      id: "seed-owner",
      name: "Leady Owner",
      email: "owner@leady.local",
      emailVerified: true,
      role: "business_owner",
      isOnboarded: true,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

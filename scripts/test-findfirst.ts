// Test findFirst query

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

console.log('[test] cwd:', process.cwd());
console.log('[test] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL! })),
  });
  try {
    const clash = await prisma.user.findFirst({
      where: { OR: [{ phone: "+919711917317", role: "ADMIN" }, { email: "theneuronacademy@gmail.com" }] },
      select: { id: true, role: true },
    });
    console.log('TEST findFirst - Found:', clash);
  } catch (e) {
    console.error("TEST FAILED:");
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
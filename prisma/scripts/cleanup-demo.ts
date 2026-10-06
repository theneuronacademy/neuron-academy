// Phase 10 — safe demo-data cleanup (Supabase, idempotent).
// Removes ONLY records created by prisma/seed.ts, identified by seed markers:
// - users/students/faculty with @demo.local emails, NA-DEMO-*/FAC-DEMO-* ids
// - records with seed-* ids, and the 5 catalogue-mirror course slugs
// - tests created by the demo admin account
// Order respects foreign keys (children first). Schema, migrations and real
// academy data are never touched. No DROP/TRUNCATE/reset anywhere.
// Run: npm run db:cleanup-demo

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { COURSES } from "../../data/courses";

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

const SEED_IDS = {
  batch: ["seed-batch-demo-01"],
  banner: ["seed-banner-01"],
  popup: ["seed-popup-01"],
  gallery: ["seed-gallery-01"],
  testimonial: ["seed-testimonial-01"],
  announcement: ["seed-announcement-01"],
  enquiry: ["seed-enquiry-01"],
  notification: ["seed-notification-01"],
  test: ["seed-test-01"],
  question: ["seed-question-01"],
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — aborting.");
    process.exit(1);
  }
  const report: Record<string, number> = {};
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@demo.local" } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);
  const demoStudents = await prisma.student.findMany({
    where: { OR: [{ email: { endsWith: "@demo.local" } }, { studentId: { startsWith: "NA-DEMO-" } }] },
    select: { id: true },
  });
  const demoStudentIds = demoStudents.map((s) => s.id);
  const demoTests = await prisma.test.findMany({
    where: { OR: [{ id: { in: SEED_IDS.test } }, { createdById: { in: demoUserIds } }] },
    select: { id: true },
  });
  const demoTestIds = demoTests.map((t) => t.id);

  // Children first (respect FK constraints; parents use SetNull/Restrict safely after).
  report.attendance = (await prisma.attendance.deleteMany({ where: { studentId: { in: demoStudentIds } } })).count;
  report.testAttempt = (await prisma.testAttempt.deleteMany({ where: { studentId: { in: demoStudentIds } } })).count;
  report.result = (
    await prisma.result.deleteMany({ where: { OR: [{ testId: { in: demoTestIds } }, { studentId: { in: demoStudentIds } }] } })
  ).count;
  report.question = (await prisma.question.deleteMany({ where: { OR: [{ id: { in: SEED_IDS.question } }, { testId: { in: demoTestIds } }] } })).count;
  report.test = (await prisma.test.deleteMany({ where: { id: { in: demoTestIds } } })).count;
  report.notification = (
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { id: { in: SEED_IDS.notification } },
          { createdById: { in: demoUserIds } },
          { targetStudentId: { in: demoStudentIds } },
        ],
      },
    })
  ).count;
  report.enquiry = (await prisma.enquiry.deleteMany({ where: { id: { in: SEED_IDS.enquiry } } })).count;
  report.student = (await prisma.student.deleteMany({ where: { id: { in: demoStudentIds } } })).count;
  report.batch = (await prisma.batch.deleteMany({ where: { id: { in: SEED_IDS.batch } } })).count;
  report.faculty = (
    await prisma.faculty.deleteMany({
      where: { OR: [{ email: { endsWith: "@demo.local" } }, { facultyId: { startsWith: "FAC-DEMO-" } }] },
    })
  ).count;
  report.announcement = (await prisma.announcement.deleteMany({ where: { id: { in: SEED_IDS.announcement } } })).count;
  report.banner = (await prisma.banner.deleteMany({ where: { id: { in: SEED_IDS.banner } } })).count;
  report.popup = (await prisma.popup.deleteMany({ where: { id: { in: SEED_IDS.popup } } })).count;
  report.galleryItem = (await prisma.galleryItem.deleteMany({ where: { id: { in: SEED_IDS.gallery } } })).count;
  report.testimonial = (await prisma.testimonial.deleteMany({ where: { id: { in: SEED_IDS.testimonial } } })).count;
  // Seeded courses mirror the catalogue slugs (website falls back to the
  // static real catalogue in data/courses.ts, so nothing breaks).
  report.course = (await prisma.course.deleteMany({ where: { slug: { in: COURSES.map((c) => c.id) } } })).count;
  report.user = (await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } })).count;

  console.log("CLEANUP:" + JSON.stringify(report));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("CLEANUP-FAILED:" + (e instanceof Error ? e.message : e));
  process.exit(1);
});

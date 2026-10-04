// Phase 3 — safe development seed. ALL data is clearly fake/demo.
// Real academy/student data must NEVER be seeded. Run: npm run db:seed
// Requires DATABASE_URL. Idempotent (upserts on unique fields).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COURSES } from "../data/courses";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — skipping seed.");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: { name: "Demo Admin", email: "admin@demo.local", phone: "+91 90000 00001", passwordHash, role: "ADMIN" },
  });

  // Courses mirror the public catalogue so website mapping stays 1:1.
  for (const [i, c] of COURSES.entries()) {
    await prisma.course.upsert({
      where: { slug: c.id },
      update: {},
      create: {
        name: c.name,
        slug: c.id,
        description: c.desc,
        shortDescription: c.desc,
        image: c.image,
        duration: c.duration,
        category: c.category,
        target: c.target,
        mode: c.mode,
        facultyName: c.faculty,
        badge: c.badge,
        accent: c.accent,
        subjects: c.subjects,
        highlights: c.highlights,
        displayOrder: i,
      },
    });
  }
  const course = await prisma.course.findFirstOrThrow();

  const facultyDefs = [
    { email: "faculty.demo1@demo.local", name: "Demo Physics Mentor", facultyId: "FAC-DEMO-01", subject: "Physics" },
    { email: "faculty.demo2@demo.local", name: "Demo Biology Mentor", facultyId: "FAC-DEMO-02", subject: "Biology" },
  ];
  for (const f of facultyDefs) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      update: {},
      create: { name: f.name, email: f.email, passwordHash, role: "FACULTY" },
    });
    await prisma.faculty.upsert({
      where: { email: f.email },
      update: {},
      create: { facultyId: f.facultyId, name: f.name, email: f.email, phone: "+91 90000 00002", qualification: "M.Sc (Demo)", experience: "5 yrs (demo)", bio: "Demo mentor profile.", subject: f.subject, userId: user.id },
    });
  }
  const faculty = await prisma.faculty.findFirstOrThrow();

  const batch = await prisma.batch.upsert({
    where: { id: "seed-batch-demo-01" },
    update: {},
    create: { id: "seed-batch-demo-01", name: "Demo Batch A", courseId: course.id, facultyId: faculty.id, status: "ACTIVE" },
  });

  const studentDefs = [
    { email: "student1@demo.local", name: "Demo Student One", studentId: "NA-DEMO-001" },
    { email: "student2@demo.local", name: "Demo Student Two", studentId: "NA-DEMO-002" },
  ];
  for (const s of studentDefs) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { name: s.name, email: s.email, passwordHash, role: "STUDENT" },
    });
    await prisma.student.upsert({
      where: { email: s.email },
      update: {},
      create: { studentId: s.studentId, name: s.name, email: s.email, phone: "+91 90000 00003", courseId: course.id, batchId: batch.id, userId: user.id },
    });
  }

  await prisma.banner.upsert({
    where: { id: "seed-banner-01" },
    update: {},
    create: { id: "seed-banner-01", title: "Demo Banner — Admissions Open", subtitle: "Demo only", description: "Seeded demo banner.", buttonText: "Explore", buttonUrl: "#courses", isActive: true, displayOrder: 1 },
  });
  await prisma.popup.upsert({
    where: { id: "seed-popup-01" },
    update: {},
    create: { id: "seed-popup-01", title: "Demo Popup", message: "Seeded demo popup.", buttonText: "OK", buttonUrl: "#contact", isActive: false },
  });
  await prisma.galleryItem.upsert({
    where: { id: "seed-gallery-01" },
    update: {},
    create: { id: "seed-gallery-01", title: "Demo Campus Photo", imageUrl: "/images/gallery-g1.jpg", category: "Academy" },
  });
  await prisma.testimonial.upsert({
    where: { id: "seed-testimonial-01" },
    update: {},
    create: { id: "seed-testimonial-01", name: "Demo Student", role: "JEE", message: "Seeded demo testimonial.", rating: 5 },
  });
  await prisma.announcement.upsert({
    where: { id: "seed-announcement-01" },
    update: {},
    create: { id: "seed-announcement-01", title: "Demo announcement", content: "Seeded demo ticker.", isActive: true, createdById: admin.id },
  });
  await prisma.enquiry.upsert({
    where: { id: "seed-enquiry-01" },
    update: {},
    create: { id: "seed-enquiry-01", name: "Demo Parent", phone: "+91 90000 00004", message: "Seeded demo enquiry.", status: "NEW" },
  });
  await prisma.notification.upsert({
    where: { id: "seed-notification-01" },
    update: {},
    create: { id: "seed-notification-01", title: "Demo notice", message: "Seeded demo notification.", audience: "ALL_STUDENTS", status: "SENT", sentAt: new Date(), createdById: admin.id },
  });

  const test = await prisma.test.upsert({
    where: { id: "seed-test-01" },
    update: {},
    create: { id: "seed-test-01", title: "Demo Practice Test", description: "Seeded demo test.", batchId: batch.id, createdById: admin.id, type: "PRACTICE", duration: 60, totalQuestions: 2, totalMarks: 8, status: "PUBLISHED" },
  });
  await prisma.question.upsert({
    where: { id: "seed-question-01" },
    update: {},
    create: { id: "seed-question-01", testId: test.id, questionText: "Demo: 2 + 2 = ?", questionType: "MCQ", optionA: "3", optionB: "4", optionC: "5", optionD: "6", correctAnswer: "B", marks: 4, order: 1 },
  });

  console.log("Seed complete (demo data only). Login hint: admin@demo.local / demo1234 (dev only).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

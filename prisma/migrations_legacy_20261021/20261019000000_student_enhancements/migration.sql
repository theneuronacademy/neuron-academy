-- Student Module Enhancements (Phase 20+)
-- Multi-attempt tests, 2FA/TOTP, streak tracking, analytics, attachments, cached URLs

-- AlterTable: Test - add maxAttempts and calendarEventId
ALTER TABLE "Test" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Test" ADD COLUMN "calendarEventId" TEXT;

-- CreateIndex for Test
CREATE INDEX "Test_calendarEventId_idx" ON "Test"("calendarEventId");

-- AlterTable: TestAttempt - add attemptNumber, syncedAt, offlineAnswers, and unique constraint
ALTER TABLE "TestAttempt" ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TestAttempt" ADD COLUMN "syncedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN "offlineAnswers" JSONB;

-- Add unique constraint for multi-attempt tracking
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_studentId_attemptNumber_key" UNIQUE ("testId", "studentId", "attemptNumber");

-- AlterTable: Student - add 2FA, streak tracking, daily goal
ALTER TABLE "Student" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "Student" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Student" ADD COLUMN "lastTestAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex for Student streak fields
CREATE INDEX "Student_streakDays_idx" ON "Student"("streakDays");

-- AlterTable: Result - add analytics fields
ALTER TABLE "Result" ADD COLUMN "timePerQuestion" JSONB;
ALTER TABLE "Result" ADD COLUMN "topicBreakdown" JSONB;

-- AlterTable: Doubt - add attachment support
ALTER TABLE "Doubt" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Doubt" ADD COLUMN "attachmentMimeType" TEXT;
ALTER TABLE "Doubt" ADD COLUMN "attachmentSize" INTEGER;

-- AlterTable: Book - add cached URLs
ALTER TABLE "Book" ADD COLUMN "cachedCoverUrl" TEXT;
ALTER TABLE "Book" ADD COLUMN "cachedPdfUrl" TEXT;
ALTER TABLE "Book" ADD COLUMN "cacheExpiresAt" TIMESTAMP(3);

-- CreateIndex for Book cached URLs
CREATE INDEX "Book_cacheExpiresAt_idx" ON "Book"("cacheExpiresAt");
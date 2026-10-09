-- Homepage results-showcase CMS (toppers wall).
-- Additive only: one new table + index. No existing table is altered.
-- UNAPPLIED: database deployment is still pending (operator action).
-- Display-only marketing rows decoupled from the Result marks table:
-- no phone, email, login identity or marks history is stored here.

-- CreateTable
CREATE TABLE "ResultShowcase" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "exam" TEXT NOT NULL DEFAULT 'JEE Main',
    "achievement" TEXT NOT NULL,
    "score" TEXT,
    "year" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: public published-ordered listing
CREATE INDEX "ResultShowcase_isActive_displayOrder_idx" ON "ResultShowcase"("isActive", "displayOrder");

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "category" TEXT;

-- CreateTable
CREATE TABLE "HomepageContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageContent_key_key" ON "HomepageContent"("key");

-- CreateIndex
CREATE INDEX "HomepageContent_key_idx" ON "HomepageContent"("key");

-- CreateIndex
CREATE INDEX "HomepageContent_isActive_idx" ON "HomepageContent"("isActive");

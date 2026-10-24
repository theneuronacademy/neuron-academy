-- Academy media (additive, non-destructive).
-- 1) GalleryItem grows into a multi-media model (images AND videos):
--    mediaType/publicId/videoPublicId/caption/altText/videoUrl/animation.
--    Existing rows keep their imageUrl/title/category and stay visible;
--    imageUrl becomes nullable only so video rows can omit an image asset.
-- 2) AboutImage is a NEW independent table for the "About the Academy"
--    section media (kept separate from GalleryItem on purpose).

-- AlterTable: GalleryItem
ALTER TABLE "GalleryItem" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "GalleryItem" ALTER COLUMN "imageUrl" DROP NOT NULL;
ALTER TABLE "GalleryItem" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN "publicId" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN "videoPublicId" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN "caption" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN "altText" TEXT;
ALTER TABLE "GalleryItem" ADD COLUMN "animation" TEXT NOT NULL DEFAULT 'none';

-- CreateTable: AboutImage
CREATE TABLE "AboutImage" (
  "id" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "publicId" TEXT,
  "caption" TEXT,
  "altText" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AboutImage_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mrp" INTEGER,
ADD COLUMN     "paymentLink" TEXT,
ADD COLUMN     "price" INTEGER,
ADD COLUMN     "sampleUrl" TEXT;

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "bookTitle" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerMobile" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "adminNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "upiId" TEXT,
    "payeeName" TEXT,
    "paymentLink" TEXT,
    "instructions" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_orderNo_key" ON "StoreOrder"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_accessToken_key" ON "StoreOrder"("accessToken");

-- CreateIndex
CREATE INDEX "StoreOrder_status_createdAt_idx" ON "StoreOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_buyerMobile_idx" ON "StoreOrder"("buyerMobile");

-- CreateIndex
CREATE INDEX "StoreOrder_bookId_idx" ON "StoreOrder"("bookId");

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


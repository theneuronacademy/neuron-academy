-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "gatewayLinkId" TEXT,
ADD COLUMN     "gatewayLinkUrl" TEXT,
ADD COLUMN     "gatewayRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_gatewayLinkId_key" ON "StoreOrder"("gatewayLinkId");


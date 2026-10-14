-- Biometric persistent enrollment mapping + device auth/health fields.
-- Additive only: no table is altered in a breaking way, no data is touched.
-- Apply with `npm run db:deploy` (prisma migrate deploy). NEVER db push.
-- Until applied, application code degrades gracefully (mappings skipped,
-- secrets treated as unconfigured) — see lib/adms.ts + biometric routes.

-- CreateEnum
CREATE TYPE "BiometricUserType" AS ENUM ('STUDENT', 'FACULTY');

-- AlterTable
ALTER TABLE "BiometricDevice" ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT,
ADD COLUMN "authSecretHash" TEXT;

-- CreateTable
CREATE TABLE "BiometricUserMap" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "biometricUserId" TEXT NOT NULL,
    "userType" "BiometricUserType" NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricUserMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricUserMap_deviceId_biometricUserId_key" ON "BiometricUserMap"("deviceId", "biometricUserId");

-- CreateIndex
CREATE INDEX "BiometricUserMap_deviceId_idx" ON "BiometricUserMap"("deviceId");

-- CreateIndex
CREATE INDEX "BiometricUserMap_userType_userId_idx" ON "BiometricUserMap"("userType", "userId");

-- AddForeignKey
ALTER TABLE "BiometricUserMap" ADD CONSTRAINT "BiometricUserMap_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

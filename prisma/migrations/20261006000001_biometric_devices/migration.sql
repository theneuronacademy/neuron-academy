-- CreateEnum
CREATE TYPE "BiometricDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "serialNumber" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'X2000',
    "ipAddress" TEXT,
    "port" INTEGER,
    "protocol" TEXT NOT NULL DEFAULT 'ADMS',
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "failedEvents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_serialNumber_key" ON "BiometricDevice"("serialNumber");

-- CreateTable
CREATE TABLE "BiometricDeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "biometricUserId" TEXT,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "attendanceId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricDeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiometricDeviceEvent_deviceId_idx" ON "BiometricDeviceEvent"("deviceId");

-- CreateIndex
CREATE INDEX "BiometricDeviceEvent_biometricUserId_idx" ON "BiometricDeviceEvent"("biometricUserId");

-- CreateIndex
CREATE INDEX "BiometricDeviceEvent_processed_idx" ON "BiometricDeviceEvent"("processed");

-- CreateIndex
CREATE INDEX "BiometricDeviceEvent_eventTimestamp_idx" ON "BiometricDeviceEvent"("eventTimestamp");

-- AddForeignKey
ALTER TABLE "BiometricDeviceEvent" ADD CONSTRAINT "BiometricDeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
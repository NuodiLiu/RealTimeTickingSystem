-- CreateEnum
CREATE TYPE "public"."CaseStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'RESOLVED_PENDING_FEEDBACK', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."StaffRole" AS ENUM ('STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."DeviceMode" AS ENUM ('REGISTRATION', 'FEEDBACK', 'DUAL');

-- CreateEnum
CREATE TYPE "public"."LockStatus" AS ENUM ('ACTIVE', 'OVERRIDDEN', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."FeedbackSessionStatus" AS ENUM ('CREATED', 'DELIVERED', 'SUBMITTED', 'OVERRIDDEN', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."Staff" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."StaffRole" NOT NULL DEFAULT 'STAFF',
    "identityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "ua" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdpAccount" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "IdpAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentCase" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "public"."CaseStatus" NOT NULL DEFAULT 'QUEUED',
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "StudentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KioskDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "mode" "public"."DeviceMode" NOT NULL DEFAULT 'DUAL',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "currentLockId" TEXT,

    CONSTRAINT "KioskDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KioskLock" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "public"."LockStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "leaseExpireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "KioskLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedbackSession" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "public"."FeedbackSessionStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "overriddenAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),

    CONSTRAINT "FeedbackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PairingSession" (
    "id" TEXT NOT NULL,
    "pairingToken" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_employeeNo_key" ON "public"."Staff"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "public"."Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_identityKey_key" ON "public"."Staff"("identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdpAccount_staffId_key" ON "public"."IdpAccount"("staffId");

-- CreateIndex
CREATE INDEX "StudentCase_status_createdAt_idx" ON "public"."StudentCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCase_staffId_idx" ON "public"."StudentCase"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_caseId_key" ON "public"."Feedback"("caseId");

-- CreateIndex
CREATE INDEX "Feedback_staffId_idx" ON "public"."Feedback"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "KioskDevice_currentLockId_key" ON "public"."KioskDevice"("currentLockId");

-- CreateIndex
CREATE INDEX "KioskDevice_mode_idx" ON "public"."KioskDevice"("mode");

-- CreateIndex
CREATE INDEX "KioskDevice_lastSeenAt_idx" ON "public"."KioskDevice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "KioskLock_deviceId_status_idx" ON "public"."KioskLock"("deviceId", "status");

-- CreateIndex
CREATE INDEX "KioskLock_leaseExpireAt_idx" ON "public"."KioskLock"("leaseExpireAt");

-- CreateIndex
CREATE INDEX "KioskLock_caseId_idx" ON "public"."KioskLock"("caseId");

-- CreateIndex
CREATE INDEX "FeedbackSession_deviceId_status_createdAt_idx" ON "public"."FeedbackSession"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackSession_caseId_idx" ON "public"."FeedbackSession"("caseId");

-- CreateIndex
CREATE INDEX "FeedbackSession_staffId_idx" ON "public"."FeedbackSession"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_pairingToken_key" ON "public"."PairingSession"("pairingToken");

-- CreateIndex
CREATE INDEX "PairingSession_pairingToken_idx" ON "public"."PairingSession"("pairingToken");

-- CreateIndex
CREATE INDEX "PairingSession_expiresAt_idx" ON "public"."PairingSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdpAccount" ADD CONSTRAINT "IdpAccount_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentCase" ADD CONSTRAINT "StudentCase_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."StudentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KioskDevice" ADD CONSTRAINT "KioskDevice_currentLockId_fkey" FOREIGN KEY ("currentLockId") REFERENCES "public"."KioskLock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KioskLock" ADD CONSTRAINT "KioskLock_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."KioskDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KioskLock" ADD CONSTRAINT "KioskLock_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KioskLock" ADD CONSTRAINT "KioskLock_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."StudentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackSession" ADD CONSTRAINT "FeedbackSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."StudentCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackSession" ADD CONSTRAINT "FeedbackSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedbackSession" ADD CONSTRAINT "FeedbackSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."KioskDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PairingSession" ADD CONSTRAINT "PairingSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."KioskDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

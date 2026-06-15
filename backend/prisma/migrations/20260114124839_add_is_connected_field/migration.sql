-- AlterTable
ALTER TABLE "KioskDevice" ADD COLUMN "isConnected" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "KioskDevice_isConnected_idx" ON "KioskDevice"("isConnected");

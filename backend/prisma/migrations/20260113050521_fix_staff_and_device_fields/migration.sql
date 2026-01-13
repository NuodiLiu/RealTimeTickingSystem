/*
  Warnings:

  - The values [DUAL] on the enum `DeviceMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."DeviceMode_new" AS ENUM ('REGISTRATION', 'FEEDBACK');
ALTER TABLE "public"."KioskDevice" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "public"."KioskDevice" ALTER COLUMN "mode" TYPE "public"."DeviceMode_new" USING ("mode"::text::"public"."DeviceMode_new");
ALTER TYPE "public"."DeviceMode" RENAME TO "DeviceMode_old";
ALTER TYPE "public"."DeviceMode_new" RENAME TO "DeviceMode";
DROP TYPE "public"."DeviceMode_old";
ALTER TABLE "public"."KioskDevice" ALTER COLUMN "mode" SET DEFAULT 'REGISTRATION';
COMMIT;

-- AlterTable
ALTER TABLE "public"."KioskDevice" ALTER COLUMN "mode" SET DEFAULT 'REGISTRATION';

-- AlterTable
ALTER TABLE "public"."Staff" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "DaybookKind" AS ENUM ('ITEM', 'PAY');

-- CreateEnum
CREATE TYPE "DaybookPay" AS ENUM ('CASH', 'INSTAPAY', 'TRANSFER', 'CREDIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DAYBOOK_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'DAYBOOK_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'DAYBOOK_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'DAYBOOK_POST';
ALTER TYPE "AuditAction" ADD VALUE 'DAYBOOK_DELIVER';
ALTER TYPE "AuditAction" ADD VALUE 'DAY_CLOSE';
ALTER TYPE "AuditAction" ADD VALUE 'STOCK_COUNT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockReason" ADD VALUE 'DAYBOOK';
ALTER TYPE "StockReason" ADD VALUE 'COUNT';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paidSplit" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DaybookEntry" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "DaybookKind" NOT NULL DEFAULT 'ITEM',
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "owed" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "person" TEXT NOT NULL DEFAULT '',
    "pay" "DaybookPay" NOT NULL DEFAULT 'CASH',
    "note" TEXT NOT NULL DEFAULT '',
    "stockOut" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "deliveredAt" TIMESTAMPTZ(3),
    "postedAt" TIMESTAMPTZ(3),
    "invoiceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DaybookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClosing" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "cashExpected" DECIMAL(14,2) NOT NULL,
    "cashActual" DECIMAL(14,2),
    "cashDiff" DECIMAL(14,2),
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "shortValue" DECIMAL(14,2) NOT NULL,
    "excessValue" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DaybookEntry_day_idx" ON "DaybookEntry"("day");

-- CreateIndex
CREATE INDEX "DaybookEntry_invoiceId_idx" ON "DaybookEntry"("invoiceId");

-- CreateIndex
CREATE INDEX "DayClosing_day_idx" ON "DayClosing"("day");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_no_key" ON "StockCount"("no");

-- AddForeignKey
ALTER TABLE "DaybookEntry" ADD CONSTRAINT "DaybookEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DaybookEntry" ADD CONSTRAINT "DaybookEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DaybookEntry" ADD CONSTRAINT "DaybookEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClosing" ADD CONSTRAINT "DayClosing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

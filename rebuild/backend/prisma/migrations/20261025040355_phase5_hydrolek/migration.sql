-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'IC_TRANSFER';
ALTER TYPE "AuditAction" ADD VALUE 'PARTNER_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'VEHICLE_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'FIELD_ORDER';
ALTER TYPE "AuditAction" ADD VALUE 'VAN_MOVE';
ALTER TYPE "AuditAction" ADD VALUE 'VAN_CLOSE';
ALTER TYPE "AuditAction" ADD VALUE 'CONTRACT_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'WA_SEND';

-- AlterEnum
ALTER TYPE "StockReason" ADD VALUE 'VAN_CLOSE';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "ic" "Company",
ADD COLUMN     "icRef" TEXT;

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "share" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMove" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL DEFAULT '',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "km" DECIMAL(12,1),
    "liters" DECIMAL(10,2),
    "note" TEXT NOT NULL DEFAULT '',
    "expenseId" TEXT,
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldOrder" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'HY',
    "date" DATE NOT NULL,
    "customer" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "addr" TEXT NOT NULL DEFAULT '',
    "eta" TEXT NOT NULL DEFAULT '',
    "items" TEXT NOT NULL DEFAULT '',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "rep" TEXT NOT NULL DEFAULT '',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "sentAt" TIMESTAMPTZ(3),
    "doneBy" TEXT NOT NULL DEFAULT '',
    "wh" TEXT NOT NULL DEFAULT '',
    "doneAt" TIMESTAMPTZ(3),
    "invoiceNo" TEXT NOT NULL DEFAULT '',
    "vehicleId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FieldOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "funder" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "VanStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanMove" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "src" TEXT NOT NULL DEFAULT 'hy',
    "funder" TEXT NOT NULL DEFAULT '',
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ref" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "vehicleId" TEXT NOT NULL DEFAULT '',
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VanMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VanClose" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vehicleId" TEXT NOT NULL DEFAULT '',
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "handed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "diffValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL DEFAULT '{}',
    "byName" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMPTZ(3),
    "reopenedBy" TEXT NOT NULL DEFAULT '',
    "reopenedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VanClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'عقد شغل',
    "title" TEXT NOT NULL,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "start" TEXT NOT NULL DEFAULT '',
    "due" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "pays" JSONB NOT NULL DEFAULT '[]',
    "costs" JSONB NOT NULL DEFAULT '[]',
    "orders" JSONB NOT NULL DEFAULT '[]',
    "hist" JSONB NOT NULL DEFAULT '[]',
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "err" TEXT NOT NULL DEFAULT '',
    "byName" TEXT NOT NULL DEFAULT '',
    "claimedAt" TIMESTAMPTZ(3),
    "doneAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerMove_partnerId_idx" ON "PartnerMove"("partnerId");

-- CreateIndex
CREATE INDEX "VehicleLog_vehicleId_date_idx" ON "VehicleLog"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FieldOrder_no_key" ON "FieldOrder"("no");

-- CreateIndex
CREATE INDEX "FieldOrder_status_idx" ON "FieldOrder"("status");

-- CreateIndex
CREATE INDEX "FieldOrder_customer_idx" ON "FieldOrder"("customer");

-- CreateIndex
CREATE UNIQUE INDEX "VanStock_productId_funder_key" ON "VanStock"("productId", "funder");

-- CreateIndex
CREATE INDEX "VanMove_date_idx" ON "VanMove"("date");

-- CreateIndex
CREATE INDEX "VanMove_productId_idx" ON "VanMove"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VanClose_date_vehicleId_key" ON "VanClose"("date", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_no_key" ON "Contract"("no");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_createdAt_idx" ON "OutboundMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PartnerMove" ADD CONSTRAINT "PartnerMove_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

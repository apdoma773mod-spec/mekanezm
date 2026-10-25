-- CreateEnum
CREATE TYPE "ShipKind" AS ENUM ('SHIP', 'DELIVERY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QUOTE_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'QUOTE_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'SHIP_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'SHIP_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'GIFT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'GRADE_MOVE';
ALTER TYPE "AuditAction" ADD VALUE 'PRODUCT_ALTS';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MOVE';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_POINTS';
ALTER TYPE "AuditAction" ADD VALUE 'KIT_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'KIT_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'SAMPLE_SAVE';
ALTER TYPE "AuditAction" ADD VALUE 'WANTED_SAVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockReason" ADD VALUE 'GIFT';
ALTER TYPE "StockReason" ADD VALUE 'GRADE';
ALTER TYPE "StockReason" ADD VALUE 'SAMPLE';

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "person" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "shipping" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "invoiceId" TEXT,
    "invoiceNo" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "kind" "ShipKind" NOT NULL DEFAULT 'SHIP',
    "status" TEXT NOT NULL DEFAULT 'new',
    "invoiceId" TEXT,
    "invoiceNo" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "phone2" TEXT NOT NULL DEFAULT '',
    "gov" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "carrier" TEXT NOT NULL DEFAULT '',
    "tracking" TEXT NOT NULL DEFAULT '',
    "driver" TEXT NOT NULL DEFAULT '',
    "driverPhone" TEXT NOT NULL DEFAULT '',
    "cod" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pieces" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "log" JSONB NOT NULL DEFAULT '[]',
    "closedAt" TIMESTAMPTZ(3),
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "toName" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL DEFAULT '',
    "toKind" TEXT NOT NULL DEFAULT 'صنايعي',
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "job" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "nid" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "payType" TEXT NOT NULL DEFAULT 'month',
    "salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shiftStart" TEXT NOT NULL DEFAULT '10:00',
    "shiftEnd" TEXT NOT NULL DEFAULT '22:00',
    "offDay" INTEGER NOT NULL DEFAULT 5,
    "startDate" DATE NOT NULL,
    "userId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "inAt" TIMESTAMPTZ(3),
    "outAt" TIMESTAMPTZ(3),
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'qr',
    "note" TEXT NOT NULL DEFAULT '',
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMove" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "month" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "expenseId" TEXT,
    "createdById" TEXT,
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPoint" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "pts" INTEGER NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "month" TEXT NOT NULL,
    "redeem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "byName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchCode" (
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "param" TEXT NOT NULL DEFAULT '',
    "def" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "sp" DECIMAL(14,2),
    "slots" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "customer" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "givenBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'out',
    "invoiceId" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WantedItem" (
    "id" TEXT NOT NULL,
    "descr" TEXT NOT NULL,
    "thumb" TEXT,
    "source" TEXT NOT NULL DEFAULT 'المحل',
    "phone" TEXT NOT NULL DEFAULT '',
    "byName" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WantedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_no_key" ON "Quote"("no");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_no_key" ON "Shipment"("no");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_invoiceId_idx" ON "Shipment"("invoiceId");

-- CreateIndex
CREATE INDEX "Gift_toName_idx" ON "Gift"("toName");

-- CreateIndex
CREATE INDEX "Gift_createdAt_idx" ON "Gift"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "Attendance_day_idx" ON "Attendance"("day");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_staffId_day_key" ON "Attendance"("staffId", "day");

-- CreateIndex
CREATE INDEX "StaffMove_staffId_month_idx" ON "StaffMove"("staffId", "month");

-- CreateIndex
CREATE INDEX "StaffPoint_staffId_idx" ON "StaffPoint"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_code_key" ON "Kit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_barcode_key" ON "Kit"("barcode");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "WantedItem_done_idx" ON "WantedItem"("done");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMove" ADD CONSTRAINT "StaffMove_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPoint" ADD CONSTRAINT "StaffPoint_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

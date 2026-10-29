-- CreateTable
CREATE TABLE "SmsIn" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "direction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaOrder" (
    "id" TEXT NOT NULL,
    "msgId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "invoiceNo" TEXT,
    "handledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaPhoto" (
    "id" TEXT NOT NULL,
    "msgId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "img" TEXT NOT NULL,
    "seen" TEXT NOT NULL DEFAULT '',
    "matches" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "handledBy" TEXT NOT NULL DEFAULT '',
    "handledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsIn_status_receivedAt_idx" ON "SmsIn"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaOrder_msgId_key" ON "WaOrder"("msgId");

-- CreateIndex
CREATE INDEX "WaOrder_status_createdAt_idx" ON "WaOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaPhoto_msgId_key" ON "WaPhoto"("msgId");

-- CreateIndex
CREATE INDEX "WaPhoto_status_createdAt_idx" ON "WaPhoto"("status", "createdAt");

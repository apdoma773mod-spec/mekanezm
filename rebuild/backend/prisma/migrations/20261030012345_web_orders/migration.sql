-- CreateTable
CREATE TABLE "WebOrder" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "eta" TEXT NOT NULL DEFAULT '',
    "invoiceNo" TEXT,
    "repliedAt" TIMESTAMPTZ(3),
    "handledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebOrder_status_createdAt_idx" ON "WebOrder"("status", "createdAt");

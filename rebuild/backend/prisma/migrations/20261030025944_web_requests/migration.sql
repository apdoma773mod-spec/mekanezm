-- CreateTable
CREATE TABLE "WebRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "imgs" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "reply" TEXT NOT NULL DEFAULT '',
    "repliedAt" TIMESTAMPTZ(3),
    "repliedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebCustom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "img" TEXT NOT NULL DEFAULT '',
    "spec" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebCustom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebRequest_status_createdAt_idx" ON "WebRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WebCustom_status_createdAt_idx" ON "WebCustom"("status", "createdAt");

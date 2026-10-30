-- CreateTable
CREATE TABLE "Portal" (
    "token" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portal_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "PortalMsg" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "media" JSONB NOT NULL DEFAULT '[]',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMsg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Portal_contactId_key" ON "Portal"("contactId");

-- CreateIndex
CREATE INDEX "PortalMsg_seen_createdAt_idx" ON "PortalMsg"("seen", "createdAt");

-- CreateIndex
CREATE INDEX "PortalMsg_contactId_createdAt_idx" ON "PortalMsg"("contactId", "createdAt");

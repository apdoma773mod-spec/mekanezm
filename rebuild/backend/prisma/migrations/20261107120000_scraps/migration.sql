-- «سوق الفضلة» moves into the system (the old site database is gone)
CREATE TABLE "Scrap" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "material" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "thick" DOUBLE PRECISION,
    "len" DOUBLE PRECISION NOT NULL,
    "wid" DOUBLE PRECISION,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "cond" TEXT NOT NULL DEFAULT 'new',
    "edge" BOOLEAN NOT NULL DEFAULT false,
    "grain" BOOLEAN NOT NULL DEFAULT false,
    "priceMode" TEXT NOT NULL DEFAULT 'ask',
    "price" DOUBLE PRECISION,
    "area" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "imgs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'site',
    "status" TEXT NOT NULL DEFAULT 'active',
    "reports" INTEGER NOT NULL DEFAULT 0,
    "reveals" INTEGER NOT NULL DEFAULT 0,
    "pingedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Scrap_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Scrap_status_expiresAt_idx" ON "Scrap"("status", "expiresAt");
CREATE INDEX "Scrap_phone_idx" ON "Scrap"("phone");

CREATE TABLE "ScrapWant" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "material" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "thick" DOUBLE PRECISION,
    "len" DOUBLE PRECISION NOT NULL,
    "wid" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "pinged" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapWant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScrapWant_status_createdAt_idx" ON "ScrapWant"("status", "createdAt");

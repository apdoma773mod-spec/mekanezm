-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "snapshot" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "gapHours" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN     "place" TEXT NOT NULL DEFAULT 'shop';

-- CreateTable
CREATE TABLE "FacePhoto" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sighting" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "channel" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "snapshot" TEXT NOT NULL DEFAULT '',
    "embedding" DOUBLE PRECISION[],
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sighting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketDay" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "MarketDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraChannel" (
    "channel" INTEGER NOT NULL,
    "lastSnapAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "snapshot" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CameraChannel_pkey" PRIMARY KEY ("channel")
);

-- CreateIndex
CREATE INDEX "FacePhoto_staffId_idx" ON "FacePhoto"("staffId");

-- CreateIndex
CREATE INDEX "Sighting_staffId_at_idx" ON "Sighting"("staffId", "at");

-- CreateIndex
CREATE INDEX "Sighting_at_idx" ON "Sighting"("at");

-- CreateIndex
CREATE UNIQUE INDEX "MarketDay_staffId_day_key" ON "MarketDay"("staffId", "day");

-- AddForeignKey
ALTER TABLE "FacePhoto" ADD CONSTRAINT "FacePhoto_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sighting" ADD CONSTRAINT "Sighting_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketDay" ADD CONSTRAINT "MarketDay_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

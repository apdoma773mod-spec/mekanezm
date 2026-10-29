-- CreateTable
CREATE TABLE "Backup" (
    "day" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "madeAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("day")
);

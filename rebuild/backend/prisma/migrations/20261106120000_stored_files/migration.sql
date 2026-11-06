-- CreateTable
CREATE TABLE "StoredFile" (
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("name")
);

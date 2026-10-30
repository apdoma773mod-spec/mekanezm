-- CreateTable
CREATE TABLE "ProductInfo" (
    "productId" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "finish" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "specs" TEXT NOT NULL DEFAULT '',
    "loc" TEXT NOT NULL DEFAULT '',
    "grp" TEXT NOT NULL DEFAULT '',
    "descr" TEXT NOT NULL DEFAULT '',
    "packs" JSONB NOT NULL DEFAULT '[]',
    "imgs" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductInfo_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "ProductInfo_grp_idx" ON "ProductInfo"("grp");

-- AddForeignKey
ALTER TABLE "ProductInfo" ADD CONSTRAINT "ProductInfo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

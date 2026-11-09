-- مكان المنتج: كمية الرف في المحل + أماكنه في المخازن، وجدول المخازن
ALTER TABLE "ProductInfo" ADD COLUMN "shelfQty" DECIMAL(14,3);
ALTER TABLE "ProductInfo" ADD COLUMN "stores" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

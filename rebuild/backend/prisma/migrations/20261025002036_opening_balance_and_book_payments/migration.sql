-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "affectsCash" BOOLEAN NOT NULL DEFAULT true;

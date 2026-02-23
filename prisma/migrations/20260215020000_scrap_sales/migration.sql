-- Scrap sales tracking for monetizing scrap/reject inventory

CREATE TABLE "ScrapSale" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "saleNumber" TEXT NOT NULL,
  "buyerName" TEXT NOT NULL,
  "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScrapSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScrapSale_companyId_saleNumber_key"
  ON "ScrapSale"("companyId", "saleNumber");

CREATE INDEX "ScrapSale_companyId_saleDate_idx"
  ON "ScrapSale"("companyId", "saleDate");

ALTER TABLE "ScrapSale"
  ADD CONSTRAINT "ScrapSale_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ScrapSaleLine" (
  "id" TEXT NOT NULL,
  "scrapSaleId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "costPerUnit" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrapSaleLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrapSaleLine_scrapSaleId_idx"
  ON "ScrapSaleLine"("scrapSaleId");

CREATE INDEX "ScrapSaleLine_skuId_idx"
  ON "ScrapSaleLine"("skuId");

ALTER TABLE "ScrapSaleLine"
  ADD CONSTRAINT "ScrapSaleLine_scrapSaleId_fkey"
  FOREIGN KEY ("scrapSaleId") REFERENCES "ScrapSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScrapSaleLine"
  ADD CONSTRAINT "ScrapSaleLine_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

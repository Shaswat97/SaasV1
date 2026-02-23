CREATE TABLE "SalesPriceList" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SalesPriceList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesPriceListLine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "discountPct" DOUBLE PRECISION DEFAULT 0,
  "taxPct" DOUBLE PRECISION DEFAULT 0,
  "minQty" DOUBLE PRECISION,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesPriceListLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesPriceList_companyId_code_key" ON "SalesPriceList"("companyId","code");
CREATE INDEX "SalesPriceList_companyId_customerId_idx" ON "SalesPriceList"("companyId","customerId");
CREATE INDEX "SalesPriceList_companyId_active_idx" ON "SalesPriceList"("companyId","active");

CREATE UNIQUE INDEX "SalesPriceListLine_priceListId_skuId_effectiveFrom_minQty_key"
  ON "SalesPriceListLine"("priceListId","skuId","effectiveFrom","minQty");
CREATE INDEX "SalesPriceListLine_companyId_skuId_effectiveFrom_idx" ON "SalesPriceListLine"("companyId","skuId","effectiveFrom");
CREATE INDEX "SalesPriceListLine_priceListId_idx" ON "SalesPriceListLine"("priceListId");

ALTER TABLE "SalesPriceList"
  ADD CONSTRAINT "SalesPriceList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesPriceList"
  ADD CONSTRAINT "SalesPriceList_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesPriceListLine"
  ADD CONSTRAINT "SalesPriceListLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesPriceListLine"
  ADD CONSTRAINT "SalesPriceListLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesPriceListLine"
  ADD CONSTRAINT "SalesPriceListLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


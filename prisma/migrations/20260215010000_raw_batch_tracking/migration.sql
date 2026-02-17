-- Raw material batch tracking + production consumption batch linkage

CREATE TABLE "RawMaterialBatch" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "skuId" TEXT NOT NULL,
  "zoneId" TEXT NOT NULL,
  "receiptLineId" TEXT,
  "batchNumber" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantityReceived" DOUBLE PRECISION NOT NULL,
  "quantityRemaining" DOUBLE PRECISION NOT NULL,
  "costPerUnit" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RawMaterialBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RawMaterialBatch_companyId_batchNumber_key"
  ON "RawMaterialBatch"("companyId", "batchNumber");

CREATE INDEX "RawMaterialBatch_companyId_skuId_zoneId_receivedAt_idx"
  ON "RawMaterialBatch"("companyId", "skuId", "zoneId", "receivedAt");

CREATE INDEX "RawMaterialBatch_receiptLineId_idx"
  ON "RawMaterialBatch"("receiptLineId");

ALTER TABLE "RawMaterialBatch"
  ADD CONSTRAINT "RawMaterialBatch_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RawMaterialBatch"
  ADD CONSTRAINT "RawMaterialBatch_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RawMaterialBatch"
  ADD CONSTRAINT "RawMaterialBatch_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RawMaterialBatch"
  ADD CONSTRAINT "RawMaterialBatch_receiptLineId_fkey"
  FOREIGN KEY ("receiptLineId") REFERENCES "GoodsReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionLogConsumption"
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "costPerUnit" DOUBLE PRECISION,
  ADD COLUMN "bomQty" DOUBLE PRECISION;

CREATE INDEX "ProductionLogConsumption_batchId_idx"
  ON "ProductionLogConsumption"("batchId");

ALTER TABLE "ProductionLogConsumption"
  ADD CONSTRAINT "ProductionLogConsumption_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "RawMaterialBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;


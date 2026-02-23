-- Link scrap sales to vendor master (scrap buyer)

ALTER TABLE "ScrapSale"
  ADD COLUMN "vendorId" TEXT;

CREATE INDEX "ScrapSale_companyId_vendorId_idx"
  ON "ScrapSale"("companyId", "vendorId");

ALTER TABLE "ScrapSale"
  ADD CONSTRAINT "ScrapSale_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

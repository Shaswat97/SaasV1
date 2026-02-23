-- Company print profile fields
ALTER TABLE "Company"
  ADD COLUMN "pan" TEXT,
  ADD COLUMN "cin" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "printHeaderLine1" TEXT,
  ADD COLUMN "printHeaderLine2" TEXT,
  ADD COLUMN "printTerms" TEXT,
  ADD COLUMN "printFooterNote" TEXT,
  ADD COLUMN "printPreparedByLabel" TEXT,
  ADD COLUMN "printAuthorizedByLabel" TEXT,
  ADD COLUMN "bankAccountName" TEXT,
  ADD COLUMN "bankAccountNumber" TEXT,
  ADD COLUMN "bankIfsc" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankBranch" TEXT,
  ADD COLUMN "bankUpiId" TEXT,
  ADD COLUMN "printShowTaxBreakup" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "printShowCompanyGstin" BOOLEAN NOT NULL DEFAULT true;

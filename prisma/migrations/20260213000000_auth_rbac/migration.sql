-- AlterTable
ALTER TABLE "Role"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "pinHash" TEXT,
ADD COLUMN "pinUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSession_tokenHash_key" ON "AppSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AppSession_companyId_employeeId_idx" ON "AppSession"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "AppSession_expiresAt_idx" ON "AppSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "AppSession"
ADD CONSTRAINT "AppSession_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSession"
ADD CONSTRAINT "AppSession_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

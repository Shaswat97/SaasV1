-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "creditDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remindBeforeDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "creditDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remindBeforeDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "creditDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remindBeforeDays" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "SalesPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPaymentAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "receiptId" TEXT,
    "billNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesPayment_companyId_customerId_idx" ON "SalesPayment"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "SalesPayment_companyId_paymentDate_idx" ON "SalesPayment"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "SalesPaymentAllocation_companyId_invoiceId_idx" ON "SalesPaymentAllocation"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "SalesPaymentAllocation_companyId_paymentId_idx" ON "SalesPaymentAllocation"("companyId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_receiptId_key" ON "VendorBill"("receiptId");

-- CreateIndex
CREATE INDEX "VendorBill_companyId_vendorId_idx" ON "VendorBill"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorBill_companyId_billDate_idx" ON "VendorBill"("companyId", "billDate");

-- CreateIndex
CREATE INDEX "VendorBillLine_billId_idx" ON "VendorBillLine"("billId");

-- CreateIndex
CREATE INDEX "VendorBillLine_skuId_idx" ON "VendorBillLine"("skuId");

-- CreateIndex
CREATE INDEX "VendorPayment_companyId_vendorId_idx" ON "VendorPayment"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorPayment_companyId_paymentDate_idx" ON "VendorPayment"("companyId", "paymentDate");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_companyId_billId_idx" ON "VendorPaymentAllocation"("companyId", "billId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_companyId_paymentId_idx" ON "VendorPaymentAllocation"("companyId", "paymentId");

-- AddForeignKey
ALTER TABLE "SalesPayment" ADD CONSTRAINT "SalesPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPayment" ADD CONSTRAINT "SalesPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPaymentAllocation" ADD CONSTRAINT "SalesPaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPaymentAllocation" ADD CONSTRAINT "SalesPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SalesPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPaymentAllocation" ADD CONSTRAINT "SalesPaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillLine" ADD CONSTRAINT "VendorBillLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "VendorPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "rawValuationMethod" TEXT NOT NULL DEFAULT 'LAST_PRICE',
    "finishedValuationMethod" TEXT NOT NULL DEFAULT 'MANUFACTURING_COST',
    "wipValuationMethod" TEXT NOT NULL DEFAULT 'RAW_CONSUMED_COST',
    "billingLine1" TEXT,
    "billingLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRole" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL DEFAULT 'RAW',
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "billingLine1" TEXT,
    "billingLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "poSequence" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorSku" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "lastPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "billingLine1" TEXT,
    "billingLine2" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scrapPct" DOUBLE PRECISION,
    "preferredVendorId" TEXT,
    "lastPurchasePrice" DOUBLE PRECISION,
    "standardCost" DOUBLE PRECISION,
    "manufacturingCost" DOUBLE PRECISION,
    "sellingPrice" DOUBLE PRECISION,
    "lowStockThreshold" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "category" TEXT,
    "baseCapacityPerMinute" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineSku" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "capacityPerMinute" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MachineSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "finishedSkuId" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingStep" (
    "id" TEXT NOT NULL,
    "routingId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "capacityPerMinute" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "finishedSkuId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "rawSkuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "scrapPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT,
    "type" TEXT NOT NULL DEFAULT 'RAW',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION DEFAULT 0,
    "taxPct" DOUBLE PRECISION DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "qcStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qcNotes" TEXT,
    "qcPassedQty" DOUBLE PRECISION DEFAULT 0,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shortClosedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "soNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUOTE',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION DEFAULT 0,
    "taxPct" DOUBLE PRECISION DEFAULT 0,
    "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "producedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scrapQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocatedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedRawCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualRawCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packagingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "invoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION DEFAULT 0,
    "taxPct" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "salesOrderLineId" TEXT,
    "finishedSkuId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT,
    "supervisorId" TEXT,
    "crewSize" INTEGER,
    "plannedQty" DOUBLE PRECISION NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closeAt" TIMESTAMP(3),
    "goodQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scrapQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedRawQty" DOUBLE PRECISION,
    "actualRawQty" DOUBLE PRECISION,
    "expectedRawCost" DOUBLE PRECISION,
    "actualRawCost" DOUBLE PRECISION,
    "materialVariancePct" DOUBLE PRECISION,
    "materialVarianceCost" DOUBLE PRECISION,
    "oeePct" DOUBLE PRECISION,
    "notes" TEXT,
    "closeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLogConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "rawSkuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionLogConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLogAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionLogAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLogCrew" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLogCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderAllocation" (
    "id" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmployeeId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_code_key" ON "Employee"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRole_employeeId_roleId_key" ON "EmployeeRole"("employeeId", "roleId");

-- CreateIndex
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");

-- CreateIndex
CREATE INDEX "Vendor_companyId_vendorType_idx" ON "Vendor"("companyId", "vendorType");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_companyId_code_key" ON "Vendor"("companyId", "code");

-- CreateIndex
CREATE INDEX "VendorSku_companyId_vendorId_idx" ON "VendorSku"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorSku_companyId_skuId_idx" ON "VendorSku"("companyId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorSku_vendorId_skuId_key" ON "VendorSku"("vendorId", "skuId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE INDEX "Sku_companyId_type_idx" ON "Sku"("companyId", "type");

-- CreateIndex
CREATE INDEX "Sku_companyId_preferredVendorId_idx" ON "Sku"("companyId", "preferredVendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_companyId_code_key" ON "Sku"("companyId", "code");

-- CreateIndex
CREATE INDEX "StockLedger_companyId_skuId_zoneId_idx" ON "StockLedger"("companyId", "skuId", "zoneId");

-- CreateIndex
CREATE INDEX "StockLedger_companyId_createdAt_idx" ON "StockLedger"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_skuId_idx" ON "StockBalance"("companyId", "skuId");

-- CreateIndex
CREATE INDEX "StockBalance_companyId_zoneId_idx" ON "StockBalance"("companyId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_companyId_skuId_zoneId_key" ON "StockBalance"("companyId", "skuId", "zoneId");

-- CreateIndex
CREATE INDEX "Machine_companyId_idx" ON "Machine"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_companyId_code_key" ON "Machine"("companyId", "code");

-- CreateIndex
CREATE INDEX "MachineSku_companyId_idx" ON "MachineSku"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineSku_companyId_machineId_skuId_key" ON "MachineSku"("companyId", "machineId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Routing_finishedSkuId_key" ON "Routing"("finishedSkuId");

-- CreateIndex
CREATE INDEX "Routing_companyId_idx" ON "Routing"("companyId");

-- CreateIndex
CREATE INDEX "RoutingStep_routingId_idx" ON "RoutingStep"("routingId");

-- CreateIndex
CREATE INDEX "RoutingStep_machineId_idx" ON "RoutingStep"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingStep_routingId_sequence_key" ON "RoutingStep"("routingId", "sequence");

-- CreateIndex
CREATE INDEX "Bom_companyId_idx" ON "Bom"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_companyId_finishedSkuId_version_key" ON "Bom"("companyId", "finishedSkuId", "version");

-- CreateIndex
CREATE INDEX "BomLine_bomId_idx" ON "BomLine"("bomId");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_bomId_rawSkuId_key" ON "BomLine"("bomId", "rawSkuId");

-- CreateIndex
CREATE INDEX "Warehouse_companyId_idx" ON "Warehouse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_companyId_code_key" ON "Warehouse"("companyId", "code");

-- CreateIndex
CREATE INDEX "Zone_companyId_idx" ON "Zone"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_companyId_code_key" ON "Zone"("companyId", "code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_vendorId_idx" ON "PurchaseOrder"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_status_idx" ON "PurchaseOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_type_idx" ON "PurchaseOrder"("companyId", "type");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_skuId_idx" ON "PurchaseOrderLine"("skuId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_companyId_vendorId_idx" ON "GoodsReceipt"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_receiptId_idx" ON "GoodsReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_poLineId_idx" ON "GoodsReceiptLine"("poLineId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_customerId_idx" ON "SalesOrder"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_status_idx" ON "SalesOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderLine_skuId_idx" ON "SalesOrderLine"("skuId");

-- CreateIndex
CREATE INDEX "SalesOrderDelivery_companyId_salesOrderId_idx" ON "SalesOrderDelivery"("companyId", "salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderDelivery_soLineId_idx" ON "SalesOrderDelivery"("soLineId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_deliveryId_key" ON "SalesInvoice"("deliveryId");

-- CreateIndex
CREATE INDEX "SalesInvoice_companyId_salesOrderId_idx" ON "SalesInvoice"("companyId", "salesOrderId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_invoiceId_idx" ON "SalesInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_soLineId_idx" ON "SalesInvoiceLine"("soLineId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_skuId_idx" ON "SalesInvoiceLine"("skuId");

-- CreateIndex
CREATE INDEX "ProductionLog_companyId_status_idx" ON "ProductionLog"("companyId", "status");

-- CreateIndex
CREATE INDEX "ProductionLog_companyId_startAt_idx" ON "ProductionLog"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "ProductionLog_salesOrderLineId_idx" ON "ProductionLog"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "ProductionLog_finishedSkuId_idx" ON "ProductionLog"("finishedSkuId");

-- CreateIndex
CREATE INDEX "ProductionLog_machineId_idx" ON "ProductionLog"("machineId");

-- CreateIndex
CREATE INDEX "ProductionLogConsumption_companyId_logId_idx" ON "ProductionLogConsumption"("companyId", "logId");

-- CreateIndex
CREATE INDEX "ProductionLogConsumption_rawSkuId_idx" ON "ProductionLogConsumption"("rawSkuId");

-- CreateIndex
CREATE INDEX "StockReservation_companyId_skuId_idx" ON "StockReservation"("companyId", "skuId");

-- CreateIndex
CREATE INDEX "StockReservation_soLineId_idx" ON "StockReservation"("soLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_soLineId_skuId_key" ON "StockReservation"("soLineId", "skuId");

-- CreateIndex
CREATE INDEX "ProductionLogAudit_companyId_logId_idx" ON "ProductionLogAudit"("companyId", "logId");

-- CreateIndex
CREATE INDEX "ProductionLogCrew_companyId_logId_idx" ON "ProductionLogCrew"("companyId", "logId");

-- CreateIndex
CREATE INDEX "ProductionLogCrew_employeeId_idx" ON "ProductionLogCrew"("employeeId");

-- CreateIndex
CREATE INDEX "PurchaseOrderAllocation_poLineId_idx" ON "PurchaseOrderAllocation"("poLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderAllocation_soLineId_idx" ON "PurchaseOrderAllocation"("soLineId");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_createdAt_idx" ON "ActivityLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_entityType_idx" ON "ActivityLog"("companyId", "entityType");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRole" ADD CONSTRAINT "EmployeeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSku" ADD CONSTRAINT "VendorSku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSku" ADD CONSTRAINT "VendorSku_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorSku" ADD CONSTRAINT "VendorSku_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSku" ADD CONSTRAINT "MachineSku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSku" ADD CONSTRAINT "MachineSku_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSku" ADD CONSTRAINT "MachineSku_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routing" ADD CONSTRAINT "Routing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routing" ADD CONSTRAINT "Routing_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_rawSkuId_fkey" FOREIGN KEY ("rawSkuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderDelivery" ADD CONSTRAINT "SalesOrderDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderDelivery" ADD CONSTRAINT "SalesOrderDelivery_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderDelivery" ADD CONSTRAINT "SalesOrderDelivery_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SalesOrderDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLog" ADD CONSTRAINT "ProductionLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogConsumption" ADD CONSTRAINT "ProductionLogConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogConsumption" ADD CONSTRAINT "ProductionLogConsumption_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogConsumption" ADD CONSTRAINT "ProductionLogConsumption_rawSkuId_fkey" FOREIGN KEY ("rawSkuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogAudit" ADD CONSTRAINT "ProductionLogAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogAudit" ADD CONSTRAINT "ProductionLogAudit_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogCrew" ADD CONSTRAINT "ProductionLogCrew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogCrew" ADD CONSTRAINT "ProductionLogCrew_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLogCrew" ADD CONSTRAINT "ProductionLogCrew_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderAllocation" ADD CONSTRAINT "PurchaseOrderAllocation_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderAllocation" ADD CONSTRAINT "PurchaseOrderAllocation_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


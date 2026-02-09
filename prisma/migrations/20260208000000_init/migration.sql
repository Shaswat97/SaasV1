-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeRole_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "lastPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorSku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorSku_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorSku_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scrapPct" REAL,
    "preferredVendorId" TEXT,
    "lastPurchasePrice" REAL,
    "standardCost" REAL,
    "manufacturingCost" REAL,
    "sellingPrice" REAL,
    "lowStockThreshold" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Sku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sku_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "costPerUnit" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockLedger_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockLedger_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "quantityOnHand" REAL NOT NULL DEFAULT 0,
    "costPerUnit" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "category" TEXT,
    "baseCapacityPerMinute" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Machine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MachineSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "capacityPerMinute" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "MachineSku_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MachineSku_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MachineSku_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "finishedSkuId" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Routing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Routing_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutingStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routingId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "capacityPerMinute" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutingStep_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoutingStep_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "finishedSkuId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Bom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bom_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomId" TEXT NOT NULL,
    "rawSkuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "scrapPct" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BomLine_rawSkuId_fkey" FOREIGN KEY ("rawSkuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Warehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Zone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Zone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT,
    "type" TEXT NOT NULL DEFAULT 'RAW',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "closedAt" DATETIME,
    "closeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountPct" REAL DEFAULT 0,
    "taxPct" REAL DEFAULT 0,
    "expectedDate" DATETIME,
    "qcStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qcNotes" TEXT,
    "qcPassedQty" REAL DEFAULT 0,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "shortClosedQty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoodsReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "costPerUnit" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceiptLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "soNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUOTE',
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesOrderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountPct" REAL DEFAULT 0,
    "taxPct" REAL DEFAULT 0,
    "deliveredQty" REAL NOT NULL DEFAULT 0,
    "producedQty" REAL NOT NULL DEFAULT 0,
    "scrapQty" REAL NOT NULL DEFAULT 0,
    "allocatedQty" REAL NOT NULL DEFAULT 0,
    "expectedRawCost" REAL NOT NULL DEFAULT 0,
    "actualRawCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrderLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesOrderDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "deliveryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packagingCost" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrderDelivery_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrderDelivery_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "invoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoice_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SalesOrderDelivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountPct" REAL DEFAULT 0,
    "taxPct" REAL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoiceLine_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesInvoiceLine_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "salesOrderLineId" TEXT,
    "finishedSkuId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT,
    "supervisorId" TEXT,
    "crewSize" INTEGER,
    "plannedQty" REAL NOT NULL,
    "startAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closeAt" DATETIME,
    "goodQty" REAL NOT NULL DEFAULT 0,
    "rejectQty" REAL NOT NULL DEFAULT 0,
    "scrapQty" REAL NOT NULL DEFAULT 0,
    "expectedRawQty" REAL,
    "actualRawQty" REAL,
    "expectedRawCost" REAL,
    "actualRawCost" REAL,
    "materialVariancePct" REAL,
    "materialVarianceCost" REAL,
    "oeePct" REAL,
    "notes" TEXT,
    "closeNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ProductionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLog_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionLog_finishedSkuId_fkey" FOREIGN KEY ("finishedSkuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLogConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "rawSkuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionLogConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLogConsumption_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLogConsumption_rawSkuId_fkey" FOREIGN KEY ("rawSkuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockReservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLogAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionLogAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLogAudit_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLogCrew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionLogCrew_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLogCrew_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProductionLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionLogCrew_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poLineId" TEXT NOT NULL,
    "soLineId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrderAllocation_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderAllocation_soLineId_fkey" FOREIGN KEY ("soLineId") REFERENCES "SalesOrderLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmployeeId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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


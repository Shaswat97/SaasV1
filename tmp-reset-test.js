const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const company = await prisma.company.findFirst();
    if (!company) { console.log('No company'); return; }
    const companyId = company.id;

    const deletions = [
        { name: 'ActivityLog', fn: () => prisma.activityLog.deleteMany({ where: { companyId } }) },
        { name: 'AppSession', fn: () => prisma.appSession.deleteMany({ where: { companyId } }) },
        { name: 'ProductionLogCrew', fn: () => prisma.productionLogCrew.deleteMany({ where: { companyId } }) },
        { name: 'ProductionLogAudit', fn: () => prisma.productionLogAudit.deleteMany({ where: { companyId } }) },
        { name: 'ProductionLogConsumption', fn: () => prisma.productionLogConsumption.deleteMany({ where: { companyId } }) },
        { name: 'ProductionLog', fn: () => prisma.productionLog.deleteMany({ where: { companyId } }) },
        { name: 'SalesInvoiceLine', fn: () => prisma.salesInvoiceLine.deleteMany({ where: { invoice: { companyId } } }) },
        { name: 'SalesPaymentAllocation', fn: () => prisma.salesPaymentAllocation.deleteMany({ where: { companyId } }) },
        { name: 'SalesInvoice', fn: () => prisma.salesInvoice.deleteMany({ where: { companyId } }) },
        { name: 'SalesOrderDelivery', fn: () => prisma.salesOrderDelivery.deleteMany({ where: { companyId } }) },
        { name: 'SalesPayment', fn: () => prisma.salesPayment.deleteMany({ where: { companyId } }) },
        { name: 'VendorPaymentAllocation', fn: () => prisma.vendorPaymentAllocation.deleteMany({ where: { companyId } }) },
        { name: 'VendorPayment', fn: () => prisma.vendorPayment.deleteMany({ where: { companyId } }) },
        { name: 'VendorBillLine', fn: () => prisma.vendorBillLine.deleteMany({ where: { bill: { companyId } } }) },
        { name: 'VendorBill', fn: () => prisma.vendorBill.deleteMany({ where: { companyId } }) },
        { name: 'PurchaseOrderAllocation', fn: () => prisma.$executeRaw`DELETE FROM "PurchaseOrderAllocation" USING "PurchaseOrderLine", "PurchaseOrder" WHERE "PurchaseOrderAllocation"."poLineId" = "PurchaseOrderLine"."id" AND "PurchaseOrderLine"."purchaseOrderId" = "PurchaseOrder"."id" AND "PurchaseOrder"."companyId" = ${companyId}` },
        { name: 'StockReservation', fn: () => prisma.stockReservation.deleteMany({ where: { companyId } }) },
        // RawMaterialBatch is missing in current reset-data route, let's omit it to see that it fails! Oh wait, I want to hit the real error, so I'm copying exactly what reset-data currently does.
        { name: 'GoodsReceiptLine', fn: () => prisma.goodsReceiptLine.deleteMany({ where: { receipt: { companyId } } }) },
        { name: 'GoodsReceipt', fn: () => prisma.goodsReceipt.deleteMany({ where: { companyId } }) },
        { name: 'PurchaseOrderLine', fn: () => prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrder: { companyId } } }) },
        { name: 'PurchaseOrder', fn: () => prisma.purchaseOrder.deleteMany({ where: { companyId } }) },
        { name: 'SalesOrderLine', fn: () => prisma.salesOrderLine.deleteMany({ where: { salesOrder: { companyId } } }) },
        { name: 'SalesOrder', fn: () => prisma.salesOrder.deleteMany({ where: { companyId } }) },
        { name: 'StockLedger', fn: () => prisma.stockLedger.deleteMany({ where: { companyId } }) },
        { name: 'StockBalance', fn: () => prisma.stockBalance.deleteMany({ where: { companyId } }) },
        { name: 'VendorSku', fn: () => prisma.vendorSku.deleteMany({ where: { companyId } }) },
        { name: 'BomLine', fn: () => prisma.bomLine.deleteMany({ where: { bom: { companyId } } }) },
        { name: 'Bom', fn: () => prisma.bom.deleteMany({ where: { companyId } }) },
        { name: 'RoutingStep', fn: () => prisma.routingStep.deleteMany({ where: { routing: { companyId } } }) },
        { name: 'Routing', fn: () => prisma.routing.deleteMany({ where: { companyId } }) },
        { name: 'MachineSku', fn: () => prisma.machineSku.deleteMany({ where: { companyId } }) },
        { name: 'Machine', fn: () => prisma.machine.deleteMany({ where: { companyId } }) },
        { name: 'Sku', fn: () => prisma.sku.deleteMany({ where: { companyId } }) },
        { name: 'Vendor', fn: () => prisma.vendor.deleteMany({ where: { companyId } }) },
        { name: 'Customer', fn: () => prisma.customer.deleteMany({ where: { companyId } }) },
        { name: 'EmployeeRole', fn: () => prisma.employeeRole.deleteMany({ where: { employee: { companyId } } }) },
        { name: 'Employee', fn: () => prisma.employee.deleteMany({ where: { companyId } }) },
        { name: 'Zone', fn: () => prisma.zone.deleteMany({ where: { companyId } }) },
        { name: 'Warehouse', fn: () => prisma.warehouse.deleteMany({ where: { companyId } }) },
    ];

    for (const del of deletions) {
        try {
            console.log('Deleting', del.name);
            await del.fn();
        } catch (err) {
            console.error('FAILED AT:', del.name, err.message);
            return;
        }
    }
}

main().finally(() => prisma.$disconnect());

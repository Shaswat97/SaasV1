import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.activityLog.deleteMany({ where: { companyId } });
      await tx.appSession.deleteMany({ where: { companyId } });

      // Production & Scrap
      await tx.productionLogCrew.deleteMany({ where: { companyId } });
      await tx.productionLogAudit.deleteMany({ where: { companyId } });
      await tx.productionLogConsumption.deleteMany({ where: { companyId } });
      await tx.productionLog.deleteMany({ where: { companyId } });
      await tx.scrapSaleLine.deleteMany({ where: { scrapSale: { companyId } } });
      await tx.scrapSale.deleteMany({ where: { companyId } });

      // Sales
      await tx.salesInvoiceLine.deleteMany({ where: { invoice: { companyId } } });
      await tx.salesPaymentAllocation.deleteMany({ where: { companyId } });
      await tx.salesInvoice.deleteMany({ where: { companyId } });
      await tx.salesPayment.deleteMany({ where: { companyId } });
      await tx.salesOrderDelivery.deleteMany({ where: { companyId } });

      // Vendors
      await tx.vendorPaymentAllocation.deleteMany({ where: { companyId } });
      await tx.vendorBillLine.deleteMany({ where: { bill: { companyId } } });
      await tx.vendorBill.deleteMany({ where: { companyId } });
      await tx.vendorPayment.deleteMany({ where: { companyId } });

      // Purchase Orders
      await tx.purchaseOrderAllocation.deleteMany({
        where: {
          OR: [
            { poLine: { purchaseOrder: { companyId } } },
            { soLine: { salesOrder: { companyId } } }
          ]
        }
      });

      // Inventory & Receipts
      await tx.stockReservation.deleteMany({ where: { companyId } });
      await tx.rawMaterialBatch.deleteMany({ where: { companyId } });
      await tx.goodsReceiptLine.deleteMany({ where: { receipt: { companyId } } });
      await tx.goodsReceipt.deleteMany({ where: { companyId } });

      // Core Orders
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrder: { companyId } } });
      await tx.purchaseOrder.deleteMany({ where: { companyId } });
      await tx.salesOrderLine.deleteMany({ where: { salesOrder: { companyId } } });
      await tx.salesOrder.deleteMany({ where: { companyId } });

      // Stock
      await tx.stockLedger.deleteMany({ where: { companyId } });
      await tx.stockBalance.deleteMany({ where: { companyId } });

      // Master Data (Relationships first)
      await tx.vendorSku.deleteMany({ where: { companyId } });
      await tx.bomLine.deleteMany({ where: { bom: { companyId } } });
      await tx.bom.deleteMany({ where: { companyId } });
      await tx.routingStep.deleteMany({ where: { routing: { companyId } } });
      await tx.routing.deleteMany({ where: { companyId } });
      await tx.machineSku.deleteMany({ where: { companyId } });
      await tx.machine.deleteMany({ where: { companyId } });
      await tx.sku.deleteMany({ where: { companyId } });

      // Base Entities
      await tx.vendor.deleteMany({ where: { companyId } });
      await tx.customer.deleteMany({ where: { companyId } });
      await tx.employeeRole.deleteMany({ where: { employee: { companyId } } });
      await tx.employee.deleteMany({ where: { companyId } });
      await tx.zone.deleteMany({ where: { companyId } });
      await tx.warehouse.deleteMany({ where: { companyId } });
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "DELETE",
      entityType: "Company",
      entityId: companyId,
      summary: "Reset all data (kept company only)."
    });

    return jsonOk({ cleared: true });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to reset demo data");
  }
}

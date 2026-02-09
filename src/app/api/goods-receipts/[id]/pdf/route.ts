import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const receipt = await prisma.goodsReceipt.findFirst({
    where: { id: params.id, companyId },
    include: {
      vendor: true,
      purchaseOrder: true,
      lines: { include: { sku: true } },
      company: true
    }
  });

  if (!receipt) {
    return new Response("Receipt not found", { status: 404 });
  }

  const total = receipt.lines.reduce((sum, line) => sum + line.totalCost, 0);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Goods Receipt ${receipt.id}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f1b2d; padding: 32px; }
    h1 { margin-bottom: 4px; }
    .muted { color: #6b637d; }
    .section { margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f4f1fb; }
    .total { font-weight: bold; text-align: right; }
  </style>
</head>
<body>
  <h1>Goods Receipt</h1>
  <div class="muted">Receipt ID: ${receipt.id}</div>
  <div class="muted">Date: ${new Date(receipt.receivedAt).toLocaleDateString("en-IN")}</div>
  <div class="section">
    <h3>Vendor</h3>
    <div>${receipt.vendor.name}</div>
    <div class="muted">PO: ${receipt.purchaseOrder.poNumber ?? receipt.purchaseOrderId}</div>
  </div>
  <div class="section">
    <h3>Items</h3>
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th>Unit Cost</th>
          <th>Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.lines
          .map((line) => {
            return `<tr>
              <td>${line.sku.code} · ${line.sku.name}</td>
              <td>${line.quantity} ${line.sku.unit}</td>
              <td>${line.costPerUnit.toFixed(2)}</td>
              <td>${line.totalCost.toFixed(2)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    <div class="total">Total: ${total.toFixed(2)}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html"
    }
  });
}

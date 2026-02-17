import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";
import { esc, formatDate, formatMoney, renderDocumentShell } from "@/lib/print-template";

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
  const bodyHtml = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th class="num">Unit Cost</th>
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.lines
          .map((line) => `<tr>
            <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
            <td>${esc(`${line.quantity} ${line.sku.unit}`)}</td>
            <td class="num">${esc(formatMoney(line.costPerUnit))}</td>
            <td class="num">${esc(formatMoney(line.totalCost))}</td>
          </tr>`)
          .join("")}
      </tbody>
    </table>
  `;

  const totalsHtml = `
    <table class="totals">
      <tbody>
        <tr><td><strong>Total Receipt Value</strong></td><td class="num"><strong>${esc(formatMoney(total))}</strong></td></tr>
      </tbody>
    </table>
  `;

  const partyBlock = `
    <strong>Vendor</strong>
    <div class="meta">${esc(receipt.vendor.name)}</div>
    <div class="meta">PO Number: ${esc(receipt.purchaseOrder.poNumber ?? receipt.purchaseOrderId)}</div>
    <div class="meta">Receipt ID: ${esc(receipt.id)}</div>
  `;

  const html = renderDocumentShell({
    title: "Goods Receipt",
    docNumber: receipt.id,
    docDate: formatDate(receipt.receivedAt),
    company: receipt.company,
    partyBlock,
    bodyHtml,
    totalsHtml
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html"
    }
  });
}

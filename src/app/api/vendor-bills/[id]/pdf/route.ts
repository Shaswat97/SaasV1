import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";
import { esc, formatDate, formatMoney, renderDocumentShell } from "@/lib/print-template";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const bill = await prisma.vendorBill.findFirst({
    where: { id: params.id, companyId },
    include: {
      vendor: true,
      purchaseOrder: true,
      lines: { include: { sku: true } },
      company: true
    }
  });

  if (!bill) return new Response("Vendor bill not found", { status: 404 });

  const total = bill.lines.reduce((sum, line) => sum + line.totalCost, 0);

  const bodyHtml = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${bill.lines
          .map((line) => `<tr>
            <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
            <td>${esc(`${line.quantity} ${line.sku.unit}`)}</td>
            <td class="num">${esc(formatMoney(line.unitPrice))}</td>
            <td class="num">${esc(formatMoney(line.totalCost))}</td>
          </tr>`)
          .join("")}
      </tbody>
    </table>
  `;

  const totalsHtml = `
    <table class="totals">
      <tbody>
        <tr><td>Bill Total</td><td class="num">${esc(formatMoney(total))}</td></tr>
        <tr><td>Outstanding</td><td class="num">${esc(formatMoney(bill.balanceAmount ?? total))}</td></tr>
      </tbody>
    </table>
  `;

  const partyBlock = `
    <strong>Vendor</strong>
    <div class="meta">${esc(bill.vendor.name)}</div>
    <div class="meta">PO: ${esc(bill.purchaseOrder?.poNumber ?? bill.purchaseOrderId ?? "—")}</div>
    <div class="meta">Status: ${esc(bill.status)}</div>
  `;

  const html = renderDocumentShell({
    title: "Vendor Bill",
    docNumber: bill.billNumber ?? bill.id,
    docDate: formatDate(bill.billDate),
    dueDate: bill.dueDate ? formatDate(bill.dueDate) : undefined,
    company: bill.company,
    partyBlock,
    bodyHtml,
    totalsHtml
  });

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

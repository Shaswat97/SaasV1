import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";
import { esc, formatDate, formatMoney, renderDocumentShell } from "@/lib/print-template";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: {
      vendor: true,
      lines: { include: { sku: true } },
      company: true
    }
  });

  if (!order) return new Response("Purchase order not found", { status: 404 });

  const subtotal = order.lines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    return sum + line.quantity * line.unitPrice * (1 - discount / 100);
  }, 0);
  const taxTotal = order.lines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    const taxable = line.quantity * line.unitPrice * (1 - discount / 100);
    return sum + taxable * ((line.taxPct ?? 0) / 100);
  }, 0);
  const total = subtotal + taxTotal;

  const bodyHtml = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Discount %</th>
          ${(order.company.printShowTaxBreakup ?? true) ? '<th class="num">Tax %</th>' : ""}
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${order.lines
          .map((line) => {
            const discount = line.discountPct ?? 0;
            const tax = line.taxPct ?? 0;
            const lineSubtotal = line.quantity * line.unitPrice * (1 - discount / 100);
            const lineTotal = lineSubtotal * (1 + tax / 100);
            return `<tr>
              <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
              <td>${esc(`${line.quantity} ${line.sku.unit}`)}</td>
              <td class="num">${esc(formatMoney(line.unitPrice))}</td>
              <td class="num">${esc(discount.toFixed(2))}</td>
              ${(order.company.printShowTaxBreakup ?? true) ? `<td class="num">${esc(tax.toFixed(2))}</td>` : ""}
              <td class="num">${esc(formatMoney(lineTotal))}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;

  const totalsHtml = `
    <table class="totals">
      <tbody>
        <tr><td>Sub Total</td><td class="num">${esc(formatMoney(subtotal))}</td></tr>
        ${(order.company.printShowTaxBreakup ?? true) ? `<tr><td>Total Tax</td><td class="num">${esc(formatMoney(taxTotal))}</td></tr>` : ""}
        <tr><td><strong>PO Total</strong></td><td class="num"><strong>${esc(formatMoney(total))}</strong></td></tr>
      </tbody>
    </table>
  `;

  const partyBlock = `
    <strong>Vendor</strong>
    <div class="meta">${esc(order.vendor.name)}</div>
    <div class="meta">PO Type: ${esc(order.type)}</div>
    <div class="meta">Status: ${esc(order.status)}</div>
  `;

  const html = renderDocumentShell({
    title: "Purchase Order",
    docNumber: order.poNumber ?? order.id,
    docDate: formatDate(order.orderDate),
    company: order.company,
    partyBlock,
    bodyHtml,
    totalsHtml
  });

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

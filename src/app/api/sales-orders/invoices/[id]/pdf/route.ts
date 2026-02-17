import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";
import { esc, formatDate, formatMoney, renderDocumentShell } from "@/lib/print-template";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { searchParams } = new URL(request.url);
  const includePackaging = !["0", "false", "no"].includes((searchParams.get("includePackaging") ?? "").toLowerCase());

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: params.id, companyId },
    include: {
      salesOrder: { include: { customer: true } },
      lines: { include: { sku: true } },
      delivery: true,
      company: true
    }
  });

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const linesTotal = invoice.lines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    const tax = line.taxPct ?? 0;
    const discounted = line.unitPrice * (1 - discount / 100);
    return sum + line.quantity * discounted * (1 + tax / 100);
  }, 0);
  const packagingCost = includePackaging ? invoice.delivery?.packagingCost ?? 0 : 0;
  const subtotal = invoice.lines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    const discounted = line.unitPrice * (1 - discount / 100);
    return sum + line.quantity * discounted;
  }, 0);
  const taxTotal = linesTotal - subtotal;
  const total = linesTotal + packagingCost;

  const bodyHtml = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Discount %</th>
          ${(invoice.company.printShowTaxBreakup ?? true) ? '<th class="num">Tax %</th>' : ""}
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lines
          .map((line) => {
            const discount = line.discountPct ?? 0;
            const tax = line.taxPct ?? 0;
            const discounted = line.unitPrice * (1 - discount / 100);
            const lineTotal = line.quantity * discounted * (1 + tax / 100);
            return `<tr>
              <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
              <td>${esc(`${line.quantity} ${line.sku.unit}`)}</td>
              <td class="num">${esc(formatMoney(line.unitPrice))}</td>
              <td class="num">${esc(discount.toFixed(2))}</td>
              ${(invoice.company.printShowTaxBreakup ?? true) ? `<td class="num">${esc(tax.toFixed(2))}</td>` : ""}
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
        ${(invoice.company.printShowTaxBreakup ?? true) ? `<tr><td>Total Tax</td><td class="num">${esc(formatMoney(taxTotal))}</td></tr>` : ""}
        ${packagingCost > 0 ? `<tr><td>Packaging / Logistics</td><td class="num">${esc(formatMoney(packagingCost))}</td></tr>` : ""}
        <tr><td><strong>Grand Total</strong></td><td class="num"><strong>${esc(formatMoney(total))}</strong></td></tr>
      </tbody>
    </table>
  `;

  const partyBlock = `
    <strong>Bill To</strong>
    <div class="meta">${esc(invoice.salesOrder.customer.name)}</div>
    <div class="meta">Sales Order: ${esc(invoice.salesOrder.soNumber ?? "—")}</div>
    ${invoice.dueDate ? `<div class="meta">Payment Due: ${esc(formatDate(invoice.dueDate))}</div>` : ""}
  `;

  const html = renderDocumentShell({
    title: "Tax Invoice",
    docNumber: invoice.invoiceNumber ?? invoice.id,
    docDate: formatDate(invoice.invoiceDate),
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
    company: invoice.company,
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

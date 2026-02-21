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
  const includePackaging = !["0", "false", "no"].includes(
    (searchParams.get("includePackaging") ?? "").toLowerCase()
  );

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

  // Load the full order with all lines + all invoices to compute remaining balance
  const order = await prisma.salesOrder.findFirst({
    where: { id: invoice.salesOrderId, companyId },
    include: {
      lines: { include: { sku: true } },
      invoices: { include: { lines: true } }
    }
  });

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

  const showTax = invoice.company.printShowTaxBreakup ?? true;

  const bodyHtml = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Discount %</th>
          ${showTax ? '<th class="num">Tax %</th>' : ""}
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
              ${showTax ? `<td class="num">${esc(tax.toFixed(2))}</td>` : ""}
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
        ${showTax ? `<tr><td>Total Tax</td><td class="num">${esc(formatMoney(taxTotal))}</td></tr>` : ""}
        ${packagingCost > 0 ? `<tr><td>Packaging / Logistics</td><td class="num">${esc(formatMoney(packagingCost))}</td></tr>` : ""}
        <tr><td><strong>Grand Total</strong></td><td class="num"><strong>${esc(formatMoney(total))}</strong></td></tr>
      </tbody>
    </table>
  `;

  // ── Balance of Order section ────────────────────────────────────────────────
  // Compute total invoiced qty per order line across ALL invoices for this order.
  // If any line still has un-invoiced delivered qty, show a "Balance of Order" table
  // so the customer knows what quantities are still pending.
  let balanceHtml = "";
  if (order) {
    const invoicedByLine = new Map<string, number>();
    for (const inv of order.invoices) {
      for (const il of inv.lines) {
        invoicedByLine.set(il.soLineId, (invoicedByLine.get(il.soLineId) ?? 0) + il.quantity);
      }
    }

    const balanceLines = order.lines
      .map((line) => {
        const totalInvoiced = invoicedByLine.get(line.id) ?? 0;
        const remaining = Math.max(line.quantity - totalInvoiced, 0);
        return { line, totalInvoiced, remaining };
      })
      .filter((r) => r.remaining > 0);

    if (balanceLines.length > 0) {
      balanceHtml = `
        <div class="section" style="margin-top:24px; padding-top:16px; border-top:2px dashed #ddd2f5;">
          <p style="font-size:13px; font-weight:700; margin-bottom:4px; color:#5a4f70;">
            Balance of Order &mdash; Pending Deliveries
          </p>
          <p style="font-size:11px; color:#6b637d; margin-bottom:8px;">
            This is a <strong>partial invoice</strong>. The quantities below remain to be delivered 
            and will be invoiced in subsequent shipments.
          </p>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th class="num">Total Ordered</th>
                <th class="num">Invoiced To Date</th>
                <th class="num" style="color:#c07000;">Pending Qty</th>
                <th class="num">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${balanceLines
          .map(
            ({ line, totalInvoiced, remaining }) => `
                <tr>
                  <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
                  <td class="num">${esc(String(line.quantity))}</td>
                  <td class="num">${esc(String(totalInvoiced))}</td>
                  <td class="num" style="font-weight:600; color:#c07000;">${esc(String(remaining))}</td>
                  <td class="num">${esc(line.sku.unit)}</td>
                </tr>`
          )
          .join("")}
            </tbody>
          </table>
        </div>`;
    }
  }

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
    bodyHtml: bodyHtml + balanceHtml,
    totalsHtml
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html"
    }
  });
}

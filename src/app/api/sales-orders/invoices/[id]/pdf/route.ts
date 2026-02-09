import { prisma } from "@/lib/prisma";
import { getDefaultCompanyId } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
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
  const total = linesTotal + packagingCost;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoice.invoiceNumber ?? invoice.id}</title>
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
  <h1>Invoice ${invoice.invoiceNumber ?? invoice.id}</h1>
  <div class="muted">Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</div>
  <div class="section">
    <h3>Customer</h3>
    <div>${invoice.salesOrder.customer.name}</div>
    <div class="muted">Order: ${invoice.salesOrder.soNumber ?? "—"}</div>
  </div>
  <div class="section">
    <h3>Items</h3>
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Discount %</th>
          <th>Tax %</th>
          <th>Line Total</th>
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
              <td>${line.sku.code} · ${line.sku.name}</td>
              <td>${line.quantity}</td>
              <td>${line.unitPrice.toFixed(2)}</td>
              <td>${discount.toFixed(2)}</td>
              <td>${tax.toFixed(2)}</td>
              <td>${lineTotal.toFixed(2)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    ${packagingCost ? `<div class="section"><strong>Packaging/Logistics Cost:</strong> ${packagingCost.toFixed(2)}</div>` : ""}
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

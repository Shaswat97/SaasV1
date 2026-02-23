import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError } from "@/lib/api-helpers";
import { esc, formatDate, renderDocumentShell } from "@/lib/print-template";

export const dynamic = "force-dynamic";

/**
 * GET /api/sales-orders/[id]/deliveries/[deliveryId]/packing-slip
 *
 * Returns an HTML document (printable) that serves as a Packing Slip / Delivery Note.
 * It shows:
 *   - What was shipped in THIS delivery
 *   - Remaining open quantities on the order (items still to be shipped)
 * This is the customer-facing document for each partial shipment.
 */
export async function GET(
    _request: Request,
    { params }: { params: { id: string; deliveryId: string } }
) {
    const prisma = await getTenantPrisma();
    if (!prisma) return jsonError("Tenant not found", 404);
    const companyId = await getDefaultCompanyId(prisma);

    // Load delivery with full order context
    const delivery = await prisma.salesOrderDelivery.findFirst({
        where: { id: params.deliveryId, salesOrderId: params.id, companyId },
        include: {
            line: { include: { sku: true } },
            salesOrder: {
                include: {
                    customer: true,
                    company: true,
                    lines: { include: { sku: true } },
                    deliveries: { include: { line: { include: { sku: true } } } }
                }
            }
        }
    });

    if (!delivery) {
        return new Response("Delivery not found", { status: 404 });
    }

    const order = delivery.salesOrder;
    const company = order.company;

    // Build a map of total delivered qty per SKU across ALL deliveries
    const deliveredByLine = new Map<string, number>();
    for (const d of order.deliveries) {
        deliveredByLine.set(d.soLineId, (deliveredByLine.get(d.soLineId) ?? 0) + d.quantity);
    }

    // This delivery's shipped items
    const shippedRows = `
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th class="num">Ordered</th>
          <th class="num">Shipped (This Delivery)</th>
          <th class="num">Unit</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(`${delivery.line.sku.code} · ${delivery.line.sku.name}`)}</td>
          <td class="num">${esc(String(delivery.line.quantity))}</td>
          <td class="num">${esc(String(delivery.quantity))}</td>
          <td class="num">${esc(delivery.line.sku.unit)}</td>
        </tr>
      </tbody>
    </table>
  `;

    // Remaining open quantities
    const remainingLines = order.lines
        .map((line) => {
            const totalDelivered = deliveredByLine.get(line.id) ?? 0;
            const remaining = Math.max(line.quantity - totalDelivered, 0);
            return { line, totalDelivered, remaining };
        })
        .filter((r) => r.remaining > 0);

    const pendingTableHtml =
        remainingLines.length > 0
            ? `
    <div class="section">
      <p style="font-size:13px; font-weight:600; margin-bottom:6px;">Pending Shipments</p>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th class="num">Ordered</th>
            <th class="num">Shipped So Far</th>
            <th class="num">Still Pending</th>
            <th class="num">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${remainingLines
                .map(
                    ({ line, totalDelivered, remaining }) => `
            <tr>
              <td>${esc(`${line.sku.code} · ${line.sku.name}`)}</td>
              <td class="num">${esc(String(line.quantity))}</td>
              <td class="num">${esc(String(totalDelivered))}</td>
              <td class="num" style="color:#c07000; font-weight:600;">${esc(String(remaining))}</td>
              <td class="num">${esc(line.sku.unit)}</td>
            </tr>`
                )
                .join("")}
        </tbody>
      </table>
      <p style="font-size:11px; color:#6b637d; margin-top:8px;">
        Remaining items will be shipped in subsequent deliveries. 
        Please contact us if you have any questions.
      </p>
    </div>`
            : `<div class="section box" style="color:#166534; font-size:12px;">
           ✓ All items in this order have been shipped with this delivery.
         </div>`;

    const partyBlock = `
    <strong>Deliver To</strong>
    <div class="meta">${esc(order.customer.name)}</div>
    <div class="meta">Sales Order: ${esc(order.soNumber ?? order.id)}</div>
    <div class="meta">Delivery Date: ${esc(formatDate(delivery.deliveryDate))}</div>
    ${delivery.notes ? `<div class="meta">Notes: ${esc(delivery.notes)}</div>` : ""}
  `;

    const bodyHtml = `
    <p style="font-size:13px; font-weight:600; margin-bottom:6px;">Items Shipped</p>
    ${shippedRows}
    ${delivery.packagingCost > 0
            ? `<p style="font-size:12px; color:#6b637d; margin-top:6px;">Packaging / Logistics cost included in invoice: ${delivery.packagingCost.toLocaleString("en-IN")}</p>`
            : ""}
    ${pendingTableHtml}
  `;

    const html = renderDocumentShell({
        title: "Delivery Note",
        docNumber: `DN-${params.deliveryId.slice(-8).toUpperCase()}`,
        docDate: formatDate(delivery.deliveryDate),
        company,
        partyBlock,
        bodyHtml
    });

    return new Response(html, {
        headers: { "Content-Type": "text/html" }
    });
}

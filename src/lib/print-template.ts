type CompanyPrintProfile = {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  printHeaderLine1?: string | null;
  printHeaderLine2?: string | null;
  printTerms?: string | null;
  printFooterNote?: string | null;
  printPreparedByLabel?: string | null;
  printAuthorizedByLabel?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankUpiId?: string | null;
  printShowTaxBreakup?: boolean | null;
  printShowCompanyGstin?: boolean | null;
  billingLine1?: string | null;
  billingLine2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
};

export function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN");
}

function compact(items: Array<string | null | undefined>) {
  return items.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function formatAddress(company: CompanyPrintProfile) {
  return compact([
    company.billingLine1,
    company.billingLine2,
    company.billingCity,
    company.billingState,
    company.billingPostalCode,
    company.billingCountry
  ]);
}

export function renderDocumentShell({
  title,
  docNumber,
  docDate,
  dueDate,
  company,
  partyBlock,
  bodyHtml,
  totalsHtml
}: {
  title: string;
  docNumber: string;
  docDate?: string;
  dueDate?: string;
  company: CompanyPrintProfile;
  partyBlock?: string;
  bodyHtml: string;
  totalsHtml?: string;
}) {
  const header1 = company.printHeaderLine1 || company.name;
  const header2 = company.printHeaderLine2 || "";
  const address = formatAddress(company);
  const showGstin = company.printShowCompanyGstin ?? true;
  const preparedBy = company.printPreparedByLabel || "Prepared By";
  const authorizedBy = company.printAuthorizedByLabel || "Authorized Signatory";

  const companyMeta = compact([
    showGstin && company.gstin ? `GSTIN: ${company.gstin}` : null,
    company.pan ? `PAN: ${company.pan}` : null,
    company.cin ? `CIN: ${company.cin}` : null,
    company.phone ? `Phone: ${company.phone}` : null,
    company.email ? `Email: ${company.email}` : null,
    company.website ? `Web: ${company.website}` : null
  ]);

  const bankMeta = compact([
    company.bankName ? `Bank: ${company.bankName}` : null,
    company.bankBranch ? `Branch: ${company.bankBranch}` : null,
    company.bankAccountName ? `A/C Name: ${company.bankAccountName}` : null,
    company.bankAccountNumber ? `A/C No: ${company.bankAccountNumber}` : null,
    company.bankIfsc ? `IFSC: ${company.bankIfsc}` : null,
    company.bankUpiId ? `UPI: ${company.bankUpiId}` : null
  ]);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} ${esc(docNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1f1b2d; padding: 28px; margin: 0; }
    h1, h2, h3, p { margin: 0; }
    .row { display: flex; justify-content: space-between; gap: 24px; }
    .muted { color: #6b637d; font-size: 12px; }
    .title { font-size: 30px; font-weight: 700; margin-top: 10px; }
    .box { border: 1px solid #ddd2f5; border-radius: 12px; padding: 12px; background: #fcfaff; }
    .meta { font-size: 12px; line-height: 1.6; margin-top: 8px; }
    .section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd2f5; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f4efff; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 12px; margin-left: auto; width: 320px; }
    .totals td { padding: 7px 10px; }
    .sig { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .sig-box { min-height: 64px; border-top: 1px dashed #b7aacd; padding-top: 8px; font-size: 12px; color: #5a4f70; }
    .foot { margin-top: 16px; font-size: 11px; color: #6b637d; }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <h2>${esc(header1)}</h2>
      ${header2 ? `<p class="muted" style="margin-top:4px;">${esc(header2)}</p>` : ""}
      <p class="title">${esc(title)}</p>
      <p class="muted">${esc(docNumber)}</p>
    </div>
    <div class="box" style="min-width: 280px;">
      <div class="meta"><strong>Date:</strong> ${esc(docDate ?? "—")}</div>
      ${dueDate ? `<div class="meta"><strong>Due Date:</strong> ${esc(dueDate)}</div>` : ""}
      ${companyMeta.map((line) => `<div class="meta">${esc(line)}</div>`).join("")}
    </div>
  </div>

  ${address.length ? `<div class="section box"><strong>Billing Address</strong><div class="meta">${address.map(esc).join("<br/>")}</div></div>` : ""}
  ${partyBlock ? `<div class="section box">${partyBlock}</div>` : ""}

  <div class="section">${bodyHtml}</div>
  ${totalsHtml ? `<div class="section">${totalsHtml}</div>` : ""}

  ${bankMeta.length ? `<div class="section box"><strong>Bank Details</strong><div class="meta">${bankMeta.map(esc).join("<br/>")}</div></div>` : ""}
  ${company.printTerms ? `<div class="section box"><strong>Terms & Conditions</strong><div class="meta">${esc(company.printTerms).replaceAll("\n", "<br/>")}</div></div>` : ""}

  <div class="sig">
    <div class="sig-box">${esc(preparedBy)}</div>
    <div class="sig-box">${esc(authorizedBy)}</div>
  </div>
  ${company.printFooterNote ? `<div class="foot">${esc(company.printFooterNote).replaceAll("\n", "<br/>")}</div>` : ""}
</body>
</html>`;
}

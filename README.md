# RAG Industries Manufacturing Ops (Prototype)

Single-tenant manufacturing SaaS prototype for RAG Industries. Built with Next.js App Router, TypeScript, Tailwind, and Prisma (SQLite).

## What We Built

- Single-tenant manufacturing ops system with master data, transactions, production, inventory, and reporting.
- Core modules: Dashboard, Sales Orders, Purchasing (Raw + Subcontract), Production, Inventory, Reports, Activity, Settings.
- Master Data: Company, Roles, Employees, Vendors (raw + subcontract), Customers, Warehouses, Zones, Raw SKUs, Finished SKUs, BOMs, Machines, Routing Steps, Machine capacity mappings.
- Production: start/close logs, crew assignments, OEE, raw consumption actuals, variance % (burn), and audit trail.
- Inventory: stock ledger, balances by zone, valuation, cycle count, low-stock signals.
- Purchasing: draft → pending → approved → received/closed, partial receipts, PO receipt PDF, vendor pricing links.
- Sales: quotes → confirmed → production → dispatch → delivered, availability check, procurement plan, production time estimation, invoice creation.
- Reporting: inventory value, sales by customer, PO summaries, OEE, employee performance, material variance.
- Activity log: tracks create/update/delete with active user attribution.

## End-to-End User Steps

1. Run the app and seed base setup (Company, Admin role, Warehouse, Zones).
2. Set Active User (for audit trail) from the dropdown.
3. Create master data:
4. Company profile and fiscal settings.
5. Employees and Roles.
6. Vendors and vendor-SKU pricing links.
7. Raw SKUs and Finished SKUs.
8. Machines and capacity per SKU.
9. BOMs and Routing Steps (multi-step allowed).
10. Start transactions:
11. Create Purchase Orders (raw or subcontract).
12. Receive against PO (partial or full) to update inventory.
13. Create Sales Orders and review availability + procurement plan.
14. Start Production Logs for order lines or stock build.
15. Close logs with good/reject/scrap + actual raw usage.
16. Dispatch and invoice deliveries.
17. Monitor inventory, production performance, and reports.

## How This Software Helps

- Prevents stock surprises by showing raw/finished availability and shortages before confirming orders.
- Translates routing and machine capacity into production time estimates (HH:MM).
- Tracks actual raw usage vs expected (burn %) for cost control and quality signals.
- Measures employee and machine performance (OEE + rating).
- Gives a full audit trail of who changed what and when.
- Centralizes purchase, production, and sales workflows in one system.

## How To Run

1. Install dependencies:

```bash
npm install
```

2. Run migrations + seed:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000` in your browser.

## Seeding Current Data (Snapshot)

- Current seed data is stored in `prisma/seed-data.json`.
- To restore it, run:

```bash
npm run prisma:seed
```

- To update the seed snapshot with your current DB:

```bash
node scripts/export-seed-data.js
```

## Notes

- Local-only development setup (SQLite in `prisma/dev.db`).
- Base design tokens live in `src/app/globals.css`.
- App routes live under `src/app/(app)`.
- Master Data is located in Settings (not in the main navigation).
- REST-like APIs are in `src/app/api/*`.

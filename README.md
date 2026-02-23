# Techno Synergians Manufacturing Ops

Single-tenant manufacturing SaaS product by Techno Synergians. Built with Next.js App Router, TypeScript, Tailwind, and Prisma (PostgreSQL).

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

2. Configure Postgres:

- Create a local database (example):

```bash
createdb presentrag
```

- Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/presentrag?schema=public"
```

3. Run migrations + seed:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000` in your browser.

## Release Workflow (Local -> Safe -> Staging -> Main)

Use this fixed sequence for every feature release:

1. Local validation (Mac):

```bash
git checkout staging
npm run dev
```

2. Commit tested local changes (Mac):

```bash
git add .
git commit -m "your feature message"
```

3. Create immutable Safe checkpoint tag (Mac):

```bash
npm run release:safe
# Optional custom tag:
# npm run release:safe -- safe-2026-02-16-01
```

4. Push staging branch (Mac):

```bash
npm run release:staging
```

5. Deploy staging server (VPS SSH):

```bash
ssh root@<staging-vps-ip>
cd /var/www/presentrag-staging
bash scripts/deploy-staging.sh
```

6. Test on `staging.technosynergians.com` (staging DB only).

7. Promote tested staging to main (Mac):

```bash
npm run release:main
```

8. Deploy production server (VPS SSH):

```bash
ssh root@<prod-vps-ip>
cd /var/www/presentrag
bash scripts/deploy-prod.sh
```

Rules:

- Never commit directly to `main`.
- `main` is updated only from tested `staging`.
- Safe tags are rollback checkpoints.

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

- Local development uses PostgreSQL via `DATABASE_URL`.
- Base design tokens live in `src/app/globals.css`.
- App routes live under `src/app/(app)`.
- Master Data is located in Settings (not in the main navigation).
- REST-like APIs are in `src/app/api/*`.

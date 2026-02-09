# Architecture & Deployment Notes (Techno Synergians Manufacturing Ops)

This document captures the full context of what we’ve built, how the system is structured, how the database works, how it’s hosted, and the long‑term SaaS goal.

## 1) Product Goal

Build a single‑tenant manufacturing operations SaaS by Techno Synergians, with the long‑term goal of running it as a multi‑tenant system (one subdomain + database per client).

Core goals:
- Master data management (SKUs, BOMs, machines, routing, vendors, customers).
- Transactions (sales orders, purchase orders, production logs).
- Inventory with valuation and stock ledger.
- Reporting (inventory value, production OEE, employee performance).
- Activity audit trail (who did what, when).

Long‑term SaaS target:
- `tenantA.yourdomain.com` → tenant A database.
- `tenantB.yourdomain.com` → tenant B database.
- Each tenant fully isolated (separate DB).

## 2) Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS.
- **Backend:** Next.js API routes in `src/app/api/*`.
- **Database:** PostgreSQL (Prisma ORM).
- **Deployment:** VPS (Hostinger), PM2, Nginx reverse proxy.

## 3) Codebase Structure

Key locations:
- `src/app/(app)` → all authenticated UI routes.
- `src/app/api/*` → REST‑like API routes for CRUD and workflows.
- `src/components` → reusable UI components (Card, Tabs, DataTable, Modal, etc).
- `src/lib` → shared services, validation, and business logic.
- `prisma/schema.prisma` → database schema.
- `prisma/migrations/*` → migration history.
- `prisma/seed.js` + `prisma/seed-data.json` → seed snapshot.

## 4) Core Domain Model (High Level)

- **Company** (single tenant currently).
- **Employees** + Roles (admin only right now).
- **Vendors** (raw + subcontract).
- **Customers**.
- **SKUs**
  - Raw SKUs (unit, scrap %, optional preferred vendor).
  - Finished SKUs (unit, selling price, manufacturing cost).
- **BOMs** (Finished SKU → Raw SKUs + qty + scrap%).
- **Machines** (capacity, model, category).
- **Routing Steps** (per Finished SKU, per machine capacity).
- **Purchase Orders** (draft → pending → approved → received/closed).
- **Sales Orders** (quote → confirmed → production → dispatch → delivered).
- **Production Logs** (start/close, crew assignment, raw consumption actuals).
- **Inventory**
  - Stock ledger (in/out).
  - Stock balance by SKU + zone.
  - Valuation stored per movement.
- **Activity Log** (audit trail with active user).

## 5) Routing / Machine Capacity Logic

Current behavior:
- Routing entries are stored per Finished SKU.
- Each entry references a machine + capacity (units/min).
- Entries are treated as **alternative machine options** (not sequential steps).
- Sales Order modal shows per‑SKU machine options and highlights the fastest runtime.
- Production Log shows only the machines mapped to that SKU and suggests the fastest option.

Note:
- Machine occupancy is not automatically enforced (manual selection in Production Log).

## 6) Inventory + Costing

- Valuation method stored on Company:
  - RAW: last price / weighted avg / standard.
  - FINISHED: manufacturing cost / selling price.
  - WIP: raw consumed cost.
- Stock movements store cost/unit at the time of movement.
- Actual raw consumption on close log:
  - If actual > issued → OUT adjustment.
  - If actual < issued → IN adjustment.
  - Variance % stored and surfaced in performance reports.

## 7) Production Logs + Performance

- Start Log:
  - SKU, machine, planned qty, start time, crew assignment.
- Close Log:
  - Good/Reject/Scrap, close time.
  - Actual raw consumption for each raw SKU.
- Performance:
  - OEE simplified.
  - Employee performance + machine performance.
  - Material variance (burn %) tracked and reported.

## 8) Activity / Audit Trail

- An “Active User” is selected in UI.
- Each API request includes user info via headers.
- All create/update/delete operations record an Activity log.

## 9) Deployment (VPS)

Hosting:
- VPS (Hostinger).
- PostgreSQL installed on VPS.
- Node + PM2 installed.
- Nginx as reverse proxy.

Current live URL:
- `http://88.222.244.185`

### VPS Setup Summary

- PostgreSQL user: `appuser`
- Database: `rag_ops`
- App path: `/var/www/presentrag`
- Process manager: `pm2` (process name: `presentrag`)
- Nginx config: `/etc/nginx/sites-available/presentrag`

### VPS Run Commands

```bash
cd /var/www/presentrag
git pull
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart presentrag || pm2 start npm --name presentrag -- start
pm2 save
```

## 10) Local Development (Postgres)

Local environment uses PostgreSQL.

`.env`
```
DATABASE_URL="postgresql://appuser:devpass@localhost:5432/presentrag?schema=public"
```

Run:
```bash
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

## 11) Seed / Sample Data

- Current seed snapshot is stored in `prisma/seed-data.json`.
- To load it:
```bash
npm run prisma:seed
```
- To update snapshot:
```bash
node scripts/export-seed-data.js
```

## 12) Deployment Workflow (Manual)

1. Make changes locally.
2. `git commit` + `git push`.
3. SSH into VPS, `git pull`, build, restart PM2.

## 13) Known Non‑Blocking Warnings

Build currently shows React Hook dependency warnings in:
- `src/app/(app)/purchasing/page.tsx`
- `src/app/(app)/purchasing/subcontracting/page.tsx`
- `src/app/(app)/sales-orders/page.tsx`
- `src/components/Modal.tsx`

These warnings do not block production builds.

## 14) Next Major Step (Multi‑Tenant SaaS)

Planned approach:
- Tenant registry DB (stores subdomain + DB connection).
- Middleware that resolves tenant from host (subdomain).
- Dynamic Prisma connection per tenant.
- Provisioning script to:
  - Create DB
  - Run migrations
  - Seed base data

This is not implemented yet.

---

## 15) Database Provisioning (Hard Isolation Plan)

Recommended approach (most common):
- **Single PostgreSQL cluster on the VPS**
- **One database per tenant**
- **One dedicated DB user per tenant** (stronger isolation)

Why this:
- Separate DBs give clean data isolation.
- Separate users limit blast‑radius if a credential leaks.
- Operationally manageable on a single VPS.

### Provisioning Flow (per tenant)

1. **Create a new database** (e.g., `tenant_rag_industries`).
2. **Create a dedicated user** (e.g., `tenant_rag_user`).
3. **Grant ownership & privileges** only on that tenant DB.
4. **Run migrations** on the new DB.
5. **Seed base data** (company, roles, warehouse, zones).
6. **Store the mapping** in a tenant registry DB:
   - `subdomain` → `database` + `user` + `host` + `port`.

Example (Postgres):
```sql
CREATE USER tenant_rag_user WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE tenant_rag_industries OWNER tenant_rag_user;
GRANT ALL PRIVILEGES ON DATABASE tenant_rag_industries TO tenant_rag_user;
```

### Tenant Registry (Meta DB)

We keep one central DB (e.g., `tenant_registry`) with a table:
- `tenant_id`
- `subdomain`
- `db_name`
- `db_user`
- `db_password`
- `db_host`
- `db_port`

At runtime:
1. Read subdomain from request.
2. Lookup connection details in `tenant_registry`.
3. Open Prisma connection to that tenant DB.

### Can we use DBeaver?

Yes.
- Connect DBeaver to the **VPS Postgres instance**.
- You’ll see all tenant DBs in the same cluster.
- Select a tenant DB to inspect tables and data.

Note:
- Domains themselves are not stored in Postgres; only the mapping (subdomain → DB details) is stored in the tenant registry.

### How we manage this right now (today)

Current system is **single‑tenant**, one DB:
- Local: `presentrag`
- VPS: `rag_ops`

We do **not** have tenant provisioning logic yet.

When you’re ready, we can implement:
- Tenant registry schema + admin API.
- Tenant provisioning script (create DB/user + migrate + seed).
- Middleware to route requests to the correct tenant DB based on subdomain.

This file should be kept up to date as the system evolves. If we change database providers, deployment flow, or multi‑tenant structure, update this first.

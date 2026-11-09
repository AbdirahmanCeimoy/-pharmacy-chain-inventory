# Pharmacy Chain Inventory

Inventory and Point-of-Sale system for a multi-branch pharmacy chain in Somalia. Built as a solo entry for the Somalia 10X Challenge, Project 09.

> **Status (updated per stage):** **ALL 13 FEATURES DONE** — Stage 5b (reports + landing) + Feature 11 (stock count with POS-sales-block). 75 tests green.

## Problem

Pharmacy chains lose money when stock expires in one branch while another runs out. Stock is counted by hand, batches and expiry dates are not tracked, and owners cannot see profit per branch.

## Solution (what this project does)

- Batch-level inventory with First-Expiry-First-Out (FEFO) deduction
- Race-safe stock transactions proven by an automated concurrency test
- Multi-branch transfers, HQ-approved purchase orders, expiry alerts, per-branch profit, controlled-drugs register
- Role-based access (Owner/HQ, Branch Manager, Pharmacist)
- Somali + English UI, mobile-friendly, simulated mobile-money and SMS

## Architecture

```
React (Vite) ──► Express API ──► Service layer ──► Repository layer ──► MariaDB (InnoDB)
```

Screens never query the database. All business rules live in the service layer. All stock changes run inside a MariaDB transaction with `SELECT ... FOR UPDATE` on the eligible batches in FEFO order.

See [docs/api.md](docs/api.md) for the API reference and `docs/er-diagram.png` for the schema diagram (added in Stage 2).

## Tech Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 + React Router 6 + Axios + Recharts + i18next |
| Backend  | Node.js 20+ + Express 4 + mysql2 + Zod + jsonwebtoken + bcryptjs + helmet + express-rate-limit + pino |
| Database | MariaDB 10.4 (InnoDB, utf8mb4) — fully compatible with MySQL 8 |
| Tests    | Vitest + Supertest |
| CI       | GitHub Actions (lint, test, build) with MariaDB service container |

Exact versions are pinned in each `package-lock.json` (installed from the package manager, not invented).

## Setup from a fresh computer (Windows 11, XAMPP)

### 1. Prerequisites

- Node.js 20 LTS or newer (`node --version`)
- XAMPP with MariaDB started from the XAMPP Control Panel
- Git

### 2. Clone and install

```powershell
git clone https://github.com/<your-user>/pharmacy-chain-inventory.git
cd pharmacy-chain-inventory

# Backend
cd backend
npm install
Copy-Item .env.example .env
# edit .env — set JWT_SECRET to a long random string

# Frontend
cd ..\frontend
npm install
```

### 3. Create database

Open phpMyAdmin (`http://localhost/phpmyadmin`) and create a database named `pharmacy_chain` with collation `utf8mb4_unicode_ci`.

### 4. Migrate + seed

```powershell
cd ..\backend
npm run migrate
npm run seed
```

### 5. Run

```powershell
# Terminal 1 (backend)
cd backend
npm run dev
# API on http://localhost:4000

# Terminal 2 (frontend)
cd frontend
npm run dev
# UI on http://localhost:5173
```

### 6. Run tests

```powershell
cd backend
npm test
```

## Demo accounts (seeded)

| Role             | Email                       | Password     | Branch       |
|------------------|-----------------------------|--------------|--------------|
| Owner / HQ       | owner@pharmacy.so           | Owner@123    | — (all)      |
| Branch Manager   | manager.mog@pharmacy.so     | Manager@123  | Mogadishu-01 |
| Pharmacist       | pharm.mog@pharmacy.so       | Pharm@123    | Mogadishu-01 |
| Branch Manager   | manager.hgs@pharmacy.so     | Manager@123  | Hargeisa-01  |

(Added in Stage 2 after the seed script lands.)

## Feature checklist (DONE / PARTIAL / NOT STARTED)

| # | Feature                                   | Status       |
|---|-------------------------------------------|--------------|
| 1 | Medicine catalogue                        | DONE (CRUD, HQ-only price, unique identity, deactivate-with-stock guard, controlled flag) |
| 2 | Suppliers + purchase orders               | DONE (CRUD, PO state machine, $1000 HQ threshold, branch scoping, audit log, full UI) |
| 3 | Goods receiving (batches, expiry, cost)   | DONE (batch merge, 110% cap, 3-month warn + override, RECEIVE movement, PO status roll-up) |
| 4 | POS with FEFO + concurrency               | **DONE** (SELECT…FOR UPDATE, deterministic lock order, deadlock-retry, DB CHECK guard, multi-batch allocations). Two-cashiers-last-unit test green. |
| 5 | Receipts (sequential, COPY on reprint)    | DONE (per-branch counter inside sale tx, printable receipt with COPY stamp on re-print) |
| 6 | Returns (7-day, no controlled, write-off) | DONE (per-allocation restock, WRITE_OFF for expired batches, audit log) |
| 7 | Inter-branch transfers                    | DONE (REQUESTED→APPROVED→DISPATCHED→RECEIVED, FEFO dispatch, batch-merge receive, $500 HQ threshold) |
| 8 | Reorder suggestions                       | DONE (30-day avg sales, <14-day cover filter, 30-day suggested qty) |
| 9 | Expiry dashboard (30/60/90)               | DONE (bucket summary + colour-coded batch list; one SQL query per load) |
| 10| Controlled drugs register (immutable)     | DONE (pharmacist-only, prescription required, running balance, UPDATE/DELETE blocked by DB trigger — tested) |
| 11| Stock count                               | DONE (snapshot on start, ADJUST movement on submit with reason, POS blocks sales for covered medicines until submit/cancel) |
| 12| Profit per branch                         | DONE (per-batch actual cost; returns net both revenue and cost; day/month grouping; LineChart) |
| 13| Expiry loss report                        | DONE (monthly totals, Top-10 medicines lost, BarChart) |
| B | Layered architecture                      | DONE (routes → services → repos → pool) |
| B | Login + 3 roles + audit log               | PARTIAL (login + requireRole DONE; audit_log writes for PO submit/approve/cancel DONE; more as features land) |
| B | Relational DB ≥6 tables + migrations      | DONE (21 tables, 7 migrations, idempotent runner) |
| B | ≥15 automated tests + CI                  | DONE for test count (75/15); CI workflow waits on GitHub repo |
| B | GitHub repo + full README                 | PARTIAL (README live; GitHub is user-owned) |
| B | Security (hashing, validation, rate limit)| PARTIAL (bcrypt + Zod + rate-limit DONE; CSRF n/a for Bearer auth) |
| B | ≥2 real charts                            | DONE (Profit LineChart + Expiry-loss BarChart on /reports, both from live SQL) |
| B | Somali + English                          | PARTIAL (toggle live; all screens dual-lang as they land) |

## Known limitations (final list in Stage 5)

- Mobile money and SMS are simulated behind adapter interfaces; no real EVC Plus / Zaad / eDahab API calls.
- Barcode scanning uses typed input or the webcam (@zxing/browser) if time permits — no dedicated USB scanner support.
- No real email delivery; password reset handled by admin.

## License

MIT — personal competition entry.

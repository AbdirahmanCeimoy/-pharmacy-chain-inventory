# Medicap — Defense & Presentation Guide
## Somalia 10X Challenge · Project 09 · Pharmacy Chain Inventory

---

## PART 1: SYSTEM OVERVIEW (Guud-ahaanba Nidaamka)

### What is Medicap?
**EN:** Medicap is a full-stack pharmacy chain management system that tracks medicine inventory across multiple branches using batch-level FEFO (First Expiry, First Out) stock allocation, race-safe point-of-sale transactions, and role-based access control.

**SO:** Medicap waa nidaam buuxa oo maareynta silsilada farmashiyaha ah oo raad-raacaya daawooyinka branch-yo badan iyadoo adeegsanaysa FEFO (Ka-hor-dhaca Muddo-dhaca, Ka-hor-bixitaanka) heerka batch-ka, iib race-safe ah, iyo maaraynta gelitaanka doorka ku salaysan.

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React 19 + Vite 8 | Latest |
| Styling | Tailwind CSS 3 | 3.x |
| Routing | React Router 7 | 7.x |
| i18n | react-i18next | Latest |
| Charts | Recharts | Latest |
| Backend | Node.js + Express 5 | Node 20 |
| Database | MariaDB 10.4+ / InnoDB | 10.4+ |
| Auth | JWT + bcryptjs | Standard |
| Validation | Zod | Latest |
| Testing | Vitest + Supertest | Latest |
| CI | GitHub Actions | v4 |

### Architecture (Qaab-dhismeedka)
```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19 + Vite)            │
│  Pages → API layer → HTTP calls                         │
│  i18n (EN/SO) · Tailwind · Recharts charts              │
└──────────────┬───────────────────────────────────────────┘
               │ REST API (JSON)
┌──────────────▼───────────────────────────────────────────┐
│                    BACKEND (Express 5)                   │
│  Routes → Middleware (auth, role) → Services → Repos     │
│  Adapters: payment.adapter.js, sms.adapter.js            │
│  Helmet · CORS · Rate Limiting · Zod validation          │
└──────────────┬───────────────────────────────────────────┘
               │ mysql2/promise
┌──────────────▼───────────────────────────────────────────┐
│              DATABASE (MariaDB / InnoDB)                 │
│  21 tables · 8 migration files · FK constraints          │
│  CHECK constraints · Triggers (append-only CDR)          │
│  Indexes (idx_batch_fefo for FEFO performance)           │
└──────────────────────────────────────────────────────────┘
```

**Layered Architecture (3-tier):**
1. **UI Layer** — React pages never touch the database
2. **Service Layer** — All business logic (FEFO, validation, rules)
3. **Repository Layer** — SQL queries only, no business logic
4. **Adapter Layer** — Payment and SMS behind clean interfaces

---

## PART 2: DATABASE (21 Tables)

| # | Table | Purpose (EN) | Somali |
|---|-------|-------------|--------|
| 1 | `branches` | Pharmacy branch locations | Meelaha branch-yada |
| 2 | `users` | Staff accounts with roles | Shaqaalaha iyo doorkooda |
| 3 | `branch_counters` | Receipt/PO/transfer sequence numbers | Lambarada taxanaha |
| 4 | `medicines` | Medicine catalogue (HQ pricing) | Liiska daawooyinka |
| 5 | `suppliers` | Supplier directory | Bixiyayaasha |
| 6 | `purchase_orders` | Purchase order headers | Dalabka iibsashada |
| 7 | `purchase_order_items` | PO line items | Shaybaarka dalabka |
| 8 | `batches` | Batch-level stock per branch | Xirmooyinka daawooyinka |
| 9 | `stock_movements` | Audit trail for ALL stock changes | Diiwaanka dhaq-dhaqaaqa |
| 10 | `sales` | Sale receipt headers | Iibka — madaxa |
| 11 | `sale_items` | Items in each sale | Shaybaarka iibka |
| 12 | `sale_batch_allocations` | Which batch each unit came from | Batch-ka laga iibiyay |
| 13 | `returns` | Return headers | Soo-celinta |
| 14 | `return_items` | Returned items detail | Faahfaahinta soo-celinta |
| 15 | `transfers` | Inter-branch transfer headers | Wareejinta |
| 16 | `transfer_items` | Transfer line items | Shaybaarka wareejinta |
| 17 | `controlled_drug_register` | Append-only CDR log | Diiwaanka daawada la xakameeyay |
| 18 | `stock_counts` | Physical count sessions | Tirinta xisaabta |
| 19 | `stock_count_items` | Per-batch count results | Natiijooyinka tirinta |
| 20 | `audit_log` | Sensitive action audit trail | Diiwaanka ficilada muhiimka |
| 21 | `sms_outbox` | Simulated SMS queue | Farriimaha SMS |
| 22 | `schema_migrations` | Migration tracking | Raad-raacyada migration |

---

## PART 3: 13 REQUIRED FEATURES — STATUS CHECK

### Feature 1: Medicine Catalogue ✅ DONE
**EN:** HQ manages medicines. Unique constraint on (generic_name, strength, form, brand_name). Price is set by HQ, same across branches. Medicines with stock cannot be deleted — only deactivated.
**SO:** HQ-du waxay maareysaa daawooyinka. Magac + xoog + nooc + brand waa isku mid noqon karaan. Qiimaha HQ ayaa dejisa, branch-yada oo dhan isku mid. Daawada stock-ka leh lama tirtiri karo — waxaa laga joojin karaa kaliya.

**How to demo:** Go to Medicines page → Add a medicine → Try deleting one with stock → Show the unique constraint error if you add a duplicate.

**Code location:** `services/medicines.service.js`, `repositories/medicines.repo.js`

---

### Feature 2: Suppliers & Purchase Orders ✅ DONE
**EN:** Branch manager creates POs. Orders over $1,000 need HQ approval; smaller ones auto-approve. Status flow: Draft → Submitted → Approved → Received → Closed.
**SO:** Manager-ka branch-ka ayaa sameeyaa PO. Dalabka $1,000 ka badan waxay u baahan yihiin ogolaanshaha HQ; kuwa yar si toos ah ayaa loo ogolaaday.

**How to demo:** Create a PO under $1,000 → show it auto-approves. Create one over $1,000 → log in as Owner → approve it.

**Code location:** `services/purchase_orders.service.js` — auto-approval threshold logic at line where `total <= 1000`

---

### Feature 3: Goods Receiving ✅ DONE
**EN:** Against an approved PO, enter qty received, batch number, expiry date, actual unit cost. Expiry < 3 months triggers a warning (overridable). Qty cannot exceed ordered by >10%. Same batch number merges into existing batch.
**SO:** PO la ogolaaday ayaad ku qaadanaysaa: tirada la helay, lambarka batch-ka, taariikhda dhicitaanka, qiimaha dhabta. Haddii muddo-dhaca < 3 bilood, digniinta way soo baxdaa.

**How to demo:** Receive goods against a PO → show batch creation → try exceeding 110% quantity → show the warning for short expiry.

**Code location:** `services/receiving.service.js` — `MIN_EXPIRY_DAYS = 90`, `MAX_OVER_PCT = 10`

---

### Feature 4: Point of Sale (CORE — 25 points) ✅ DONE
**EN:** FEFO deduction — always sells from the batch expiring soonest. Expired batches are blocked. Concurrency-safe: `SELECT ... FOR UPDATE` locks batches in deterministic order (expiry_date, id). Database `CHECK (qty_on_hand >= 0)` prevents negative stock. `withTransaction` retries on deadlock.
**SO:** Iibka — wuxuu marka hore ka iibinayaa batch-ka ugu dhow in uu dhaco. Batch-yada dhacay lama iibiyo. Laba cashier oo isku mar iibinaya — mid kaliya ayaa guulaysta, midka kale "Out of stock" ayuu arkayaa.

**How to demo:**
1. Receive 2 batches of the same medicine with different expiry dates
2. Make a sale → show it deducts from the earliest-expiring batch first
3. Run the concurrency test: `npm test -- --grep "concurrency"` → show 20 parallel sales for 10 units, exactly 10 succeed

**Code location:** `services/pos.service.js` (lines 1-34 explain the full algorithm), `repositories/batches.repo.js` → `lockSellableFEFO()`

**Key technical details to explain:**
- `FOR UPDATE` → reads latest committed data, acquires row locks
- Cart items sorted by `medicine_id` → prevents cross-item deadlocks
- `decrement()` has `WHERE qty_on_hand >= ?` guard
- `CHECK (qty_on_hand >= 0)` constraint at database level
- `withTransaction({ maxRetries: 3 })` for deadlock retry

---

### Feature 5: Receipts ✅ DONE
**EN:** Receipt with branch name, date, receipt number (sequential per branch), items, prices, total, payment method, cashier name. Receipts can be reprinted.
**SO:** Rasiidka wuxuu leeyahay magaca branch-ka, taariikhda, lambarka rasiidka (taxane branch-kasta), shaybaarka, qiimaha, wadarta, habka lacag-bixinta, magaca cashier-ka.

**Code location:** `branch_counters` table locks the sequence in the same transaction as the sale. Frontend: `lib/receiptPdf.js` for PDF generation. `pages/pos/ReceiptPage.jsx` for reprint.

---

### Feature 6: Returns ✅ DONE
**EN:** Within 7 days only. Controlled drugs cannot be returned. Returned items from expired batches are written off instead of restocked. Manager or Owner approval required.
**SO:** 7 maalmood gudahood kaliya. Daawada la xakameeyay lama soo celin karo. Soo-celinta batch-yada dhacay waa la tirtiraa halkii loo soo celin lahaa stock-ka.

**Code location:** `services/returns.service.js` — `RETURN_WINDOW_DAYS = 7`, checks `is_controlled`, checks batch `expiry_date` for write-off logic.

---

### Feature 7: Inter-Branch Transfers ✅ DONE
**EN:** Status: Requested → Approved → Dispatched → Received. Auto-approved under $500. Dispatch uses FEFO. Stock in transit belongs to neither branch. Shortage flagged on receive.
**SO:** Heerarka: La codsaday → La ogolaaday → La diray → La helay. $500 ka yar si toos ah ayaa loo ogolaaday. Xirmooyinka darnaanaya branch-na ma aha.

**Code location:** `services/transfers.service.js` — `HQ_APPROVAL_THRESHOLD = 500`, FEFO batch selection on dispatch, batch merge on receive.

---

### Feature 8: Reorder Suggestions ✅ DONE
**EN:** Average daily sales over 30 days. If current stock covers < 14 days, suggest ordering enough for 30 days. No sales in 30 days → not suggested. One-click PO creation.
**SO:** Celceliska iibka maalintii 30 maalmood. Haddii stock-ku ka yar yahay 14 maalmood, wuxuu soo jeedinayaa dalabka 30 maalmood. Haddii iib la lahayn 30 maalmood → lama soo jeedinayo.

**Code location:** `services/reorder.service.js`

---

### Feature 9: Expiry Dashboard ✅ DONE
**EN:** Batches expiring in 30/60/90 days with color coding (red/orange/yellow). Expired batches auto-blocked from sale (expiry_date filter in `lockSellableFEFO`).
**SO:** Batch-yada dhacaya 30/60/90 maalmood midab (cas/orange/jaalle). Batch-yada dhacay si toos ah looga xayuubiyay iibka.

**Code location:** `pages/batches/BatchesExpiryPage.jsx`, backend filter in `lockSellableFEFO`: `expiry_date > CURDATE()`

---

### Feature 10: Controlled Drugs Register ✅ DONE
**EN:** Selling a controlled drug requires: PHARMACIST role + prescription_number + doctor_name + patient_name. Append-only register with running balance. Database triggers prevent UPDATE/DELETE on the register.
**SO:** Iibka daawada la xakameeyay waxay u baahan tahay: doorka PHARMACIST + lambarka warqadda dhakhtar + magaca dhakhtarka + magaca bukaanka. Diiwaanka wax lagu dari karo kaliya — lama beddeli karo, lama tirtiri karo.

**Code location:** `services/pos.service.js` lines 106-118 (role + prescription check), `repositories/controlled_drugs.repo.js`, `007_triggers.sql` (append-only triggers)

---

### Feature 11: Stock Count ✅ DONE
**EN:** Start count → snapshot all batches → enter physical qty + reason (DAMAGED, LOST, COUNTING_ERROR, THEFT, EXPIRED, OTHER) → adjust stock. Sales blocked during count.
**SO:** Bilow tirinta → sawir ka qaad batch-yada → geli tirada jirta + sababta → hagaaji stock-ka. Iibka waa la joojiyaa inta tirinta socoto.

**Code location:** `services/stock_counts.service.js`, POS integration at `services/pos.service.js` line 128 (`medicinesBlockedByCount`)

---

### Feature 12: Profit Per Branch ✅ DONE
**EN:** Profit = revenue − cost of specific batches sold (via `sale_batch_allocations`, never averaged). Grouped by day/month with chart. Returns reduce both revenue and cost.
**SO:** Faa'iido = dakhli − kharashka batch-yada la iibiyay (batch kasta qiimihiisa). Maalintii/Bishii. Soo-celinta waxay yaraynaysaa labadaba dakhliga iyo kharashka.

**Code location:** `services/reports.service.js` → `profitByBranch()`, uses `sale_batch_allocations` for honest cost

---

### Feature 13: Expiry Loss Report ✅ DONE
**EN:** Total value of expired/written-off stock per branch per month. Top 10 medicines lost. From `stock_movements` with type EXPIRED or WRITE_OFF. $0 for months with no losses.
**SO:** Qiimaha guud ee stock-ka dhacay/la tirtiray branch-kasta bishii. 10-ka daawada ugu badan ee la waayay.

**Code location:** `services/reports.service.js` → `expiryLossByBranch()`, `topMedicinesLost()`

---

## PART 4: 8 BASELINE REQUIREMENTS — STATUS CHECK

### Baseline 1: Layered Architecture ✅
- **Routes** → **Middleware** → **Services** → **Repositories** → **Database**
- Adapters for payment and SMS
- Screens never query DB directly

### Baseline 2: Login with Role-Based Access ✅
- JWT authentication (`auth.service.js`, `middleware/auth.js`)
- 3 roles: OWNER, MANAGER, PHARMACIST
- Server-side permission check on EVERY route (`requireRole()`, `requireOwnBranchOrOwner()`)
- Audit log table for sensitive actions (`audit_log`)
- bcryptjs password hashing

### Baseline 3: Relational Database ✅
- **21+ related tables** with PKs and FKs (well above 6 minimum)
- 8 migration files, versioned with `schema_migrations`
- Realistic seed data: Somali names (Abdirahman, Fatima, Ahmed, Khadija), real cities (Mogadishu, Hargeisa, Garowe)

### Baseline 4: Automated Tests ✅
- **85 integration tests** across 11 test files (well above 15 minimum)
- Tests cover: FEFO, concurrency (20 parallel sales), auth, medicines, POs, receiving, returns, transfers, stock counts, suppliers, reports
- Vitest + Supertest
- CI via GitHub Actions (`ci.yml`) — runs on every push/PR
- One command locally: `npm test`

### Baseline 5: Code on GitHub ✅
- Regular commits
- Full documentation

### Baseline 6: Security Basics ✅
- bcryptjs password hashing (configurable rounds via `BCRYPT_ROUNDS`)
- Zod validation on ALL inputs (server-side)
- Rate limiting (`express-rate-limit`)
- Helmet security headers
- CORS configured properly
- `.env.example` provided — no secrets in code
- `JWT_SECRET` from environment

### Baseline 7: Analytics Dashboard ✅
- **Revenue/Profit chart** — real DB queries, daily/monthly grouping
- **KPI cards** — Total Medicines, In Stock, Low Stock, Expired (all from DB)
- **Expiry Loss report** with chart
- **Trend sparklines** on dashboard cards

### Baseline 8: Somali & English ✅
- Full i18n with `react-i18next`
- EN/SO toggle on every page (public + authenticated)
- Mobile-responsive layout (Tailwind)
- Landing page (`/welcome`) fully bilingual
- Login page fully bilingual
- Dashboard and all internal pages bilingual

---

## PART 5: DEMO CHECKLIST (Liiska Demo-ga)

Follow this exact order in your presentation:

### Demo Step 1: Receive Two Batches
1. Login as Manager (manager.mog@pharmacy.so / Manager@123)
2. Go to Purchase Orders → Create a new PO
3. Receive goods with TWO different expiry dates for the same medicine
4. Show the batches in the Batches/Expiry page

### Demo Step 2: FEFO Sale
1. Login as Pharmacist (pharm.mog@pharmacy.so / Pharm@123)
2. Go to POS → sell 3 units of that medicine
3. Show that stock was deducted from the EARLIEST-expiring batch first
4. Show the receipt with all details

### Demo Step 3: Concurrency Test
1. Open terminal → `cd backend && npm test -- --grep "concurrency"`
2. Show: "20 parallel sales for 10 units — exactly 10 succeed, 10 get 409"
3. Show: stock never goes negative

### Demo Step 4: Transfer Between Branches
1. Login as Manager Mogadishu → Request transfer from Hargeisa
2. Login as Owner → Approve (if > $500)
3. Login as Manager Hargeisa → Dispatch
4. Login as Manager Mogadishu → Receive
5. Show stock_movements audit trail

### Demo Step 5: Reports & Dashboard
1. Show Expiry Dashboard → red/orange/yellow color coding
2. Show Reorder Suggestions
3. Show Profit report chart — by day and month
4. Show the main Dashboard with live KPI cards

---

## PART 6: JUDGE Q&A PREPARATION

### Q1: "How does FEFO work? Explain the code."
**EN:** The POS service calls `lockSellableFEFO()` which runs:
```sql
SELECT ... FROM batches
WHERE medicine_id = ? AND branch_id = ?
  AND is_blocked = 0 AND expiry_date > CURDATE() AND qty_on_hand > 0
ORDER BY expiry_date ASC, id ASC
FOR UPDATE
```
This locks all sellable batches in FEFO order. Then we walk through them: take as many as we need from the first batch, move to the next if needed. Expired batches are automatically excluded by `expiry_date > CURDATE()`.

**SO:** Nidaamka POS wuxuu wacaa `lockSellableFEFO()` kaas oo xidhaya batch-yada la iibin karo si ay u kala horreeyaan taariikhda dhicitaanka. Marka hore batch-ka ugu dhow ayaan ka qaadanaa, haddii aanu ku filnayn waxaan u gudubnaa kan ku xiga. Batch-yada dhacay si toos ah ayaa looga saartay `expiry_date > CURDATE()`.

---

### Q2: "How do you prevent negative stock?"
**EN:** Three layers of protection:
1. `FOR UPDATE` lock — only one transaction reads/writes at a time
2. `WHERE qty_on_hand >= ?` guard on the UPDATE statement
3. `CHECK (qty_on_hand >= 0)` constraint at the database level

Even if somehow the app logic fails, the database itself rejects negative stock.

**SO:** Saddex lakab oo ilaalin ah:
1. Qufulka `FOR UPDATE` — hal transaction kaliya ayaa isku mar aqrin/qori kara
2. Ilaalinta `WHERE qty_on_hand >= ?` marka la UPDATE-gareynayo
3. `CHECK (qty_on_hand >= 0)` — database-ka laftiisu way diidaa stock negative-ka

---

### Q3: "How does the concurrency test work?"
**EN:** We insert a batch with exactly 1 unit, then fire 2 sales simultaneously using `Promise.all([send(), send()])`. Exactly one gets HTTP 201 (success), the other gets HTTP 409 (conflict/out of stock). The batch ends at 0, never -1.

For the stress test: 10 units, 20 parallel sales. Exactly 10 succeed, 10 fail. Stock ends at 0.

**SO:** Waxaan ku darnaa batch 1 unit ah, kadib waxaan isku mar dirnaa 2 iib. Mid kaliya ayaa guulaysata (201), midka kale "Out of stock" (409) ayuu helaa. Batch-ku 0 buu ku dhammaadaa, marnaba -1 ma noqdo.

---

### Q4: "Why did you choose this tech stack?"
**EN:** React 19 + Vite for fast development. Express 5 with async error handling built in. MariaDB because the brief requires a relational database with InnoDB transactions — critical for the FEFO locking strategy. Zod for server-side validation (TypeScript-like safety in JavaScript). Vitest is fast and compatible with ES modules.

**SO:** React 19 + Vite waxa ay u fiicanyihiin horumar degdeg ah. Express 5 waxaa ku dhisan qabashada khaladaadka async. MariaDB sababtoo ah waxaa loo baahan yahay database xidhiidh leh oo leh InnoDB transactions — taas oo muhiim u ah istaraatiijiyada qufulka FEFO.

---

### Q5: "How is the profit calculated?"
**EN:** We NEVER average batch costs. Every sale records which specific batches the units came from in `sale_batch_allocations`, with the exact `unit_cost` of each batch. Profit = SUM(sale revenue) − SUM(unit_cost × qty from each batch). Returns are netted off both sides.

**SO:** MARNABA ma celcelisiino kharashka batch-yada. Iib kasta wuxuu diiwaangelin ayaa batch-ka saxda ah ee laga soo qaatay `sale_batch_allocations`, iyo qiimaha saxda ah ee batch kasta. Faa'iido = Wadarta dakhliga − Wadarta (qiimaha batch × tirada).

---

### Q6: "How do you handle the controlled drug register?"
**EN:** Three enforcement layers:
1. **Service layer:** Only PHARMACIST role can sell controlled drugs. Must provide prescription_number, doctor_name, patient_name.
2. **Register table:** Every sale writes a row with running_balance to `controlled_drug_register`.
3. **Database triggers:** `BEFORE UPDATE` and `BEFORE DELETE` triggers that `SIGNAL SQLSTATE '45000'` — making the register physically append-only at the DB level. Even if someone opens phpMyAdmin, they cannot edit or delete entries.

**SO:** Saddex lakab oo ilaalin ah:
1. Doorka PHARMACIST kaliya ayaa iibin kara. Waa in uu bixiyaa lambarka warqadda dhakhtar, magaca dhakhtarka, magaca bukaanka.
2. Iib kasta wuxuu qoraa diiwaanka oo leh miisaaniyada socon.
3. Database triggers-ku waxay ka hortagaan in la beddelo ama la tirtiro — xitaa haddii qof furay phpMyAdmin.

---

### Q7: "Is your data real or hardcoded?"
**EN:** All dashboard data comes from real database queries — `getDashboard()` calls `/api/reports/dashboard`. KPI cards, revenue chart, activity log — all are live queries against the actual tables. The seed data uses Somali names (Abdirahman, Fatima, Ahmed, Khadija) and real Somali cities (Mogadishu, Hargeisa, Garowe).

**SO:** Dhammaan xogta dashboard-ka waxay ka timaadaa su'aalo dhabta ah oo database — `getDashboard()` wuxuu wacaa `/api/reports/dashboard`. KPI cards-ka, chart-ka dakhliga, dhaqdhaqaaqa — dhammaantood waa su'aalo toos ah oo ka yimaada jadwalada dhabta ah.

---

### Q8: "How do returns handle expired batches?"
**EN:** When a customer returns items, the service checks the originating batch's expiry_date. If the batch has expired since the sale, the items are written off (is_write_off = 1) instead of being restocked. A WRITE_OFF stock_movement is recorded instead of a RETURN movement. This prevents expired medicine from re-entering sellable stock.

**SO:** Marka macmiilku soo celiyo, nidaamku wuxuu hubiyaa taariikhda dhicitaanka batch-ka asalka. Haddii batch-ku dhacay iibka ka dib, shaybaarka waa la tiraa (is_write_off = 1) halkii loo soo celin lahaa stock-ka. Tani waxay ka hortagi daawo dhacday in ay dib ugu soo noqoto stock-ka la iibin karo.

---

### Q9: "How do stock counts block sales?"
**EN:** When a stock count is IN_PROGRESS, the POS service calls `medicinesBlockedByCount(branchId, medicineIds)` before processing any sale. If any medicine in the cart is being counted, the sale is rejected with a clear error: "Sales blocked — a stock count is in progress for: [medicine names]". This prevents count/sale race conditions.

**SO:** Marka tirinta stock-ku socoto, nidaamka POS-ku wuxuu hubiyaa haddii daawada la tirinayo. Haddii daawada gaarka ahi ay ku jirto tirinta, iibka waa la diiday fariin cad: "Iibka waa la xidhay — tirinta stock-ku waa socota."

---

### Q10: "What if the judge asks about something not in the brief?"
**EN:** I documented my assumptions in the README under "Assumptions." The brief says: "If something is not covered here, choose a sensible approach yourself and record it in your README."

---

## PART 7: SCORING BREAKDOWN (100 points)

| Criterion | Points | Our Status |
|-----------|--------|-----------|
| **Core Technical Challenge** | 25 | ✅ FEFO works, concurrency test passes (85 tests), race-safe with FOR UPDATE + CHECK constraint |
| **Completeness** | 25 | ✅ All 8 baseline items done (10 pts) + All 13 features implemented (15 pts) |
| **Code Quality & Tests** | 15 | ✅ 85 integration tests, CI pipeline, clean layered architecture, documented code |
| **Security & Reliability** | 15 | ✅ Server-side auth on every route, bcrypt, Zod validation, rate limiting, Helmet, no secrets in code |
| **Live Demo & Pitch** | 10 | Follow the Demo Checklist above |
| **UX & Somali Usability** | 10 | ✅ Full EN/SO on every page, mobile-responsive, clean Tailwind UI |

---

## PART 8: DEMO ACCOUNTS

| Role | Email | Password |
|------|-------|----------|
| Owner/HQ | owner@pharmacy.so | Owner@123 |
| Manager (Mogadishu) | manager.mog@pharmacy.so | Manager@123 |
| Pharmacist (Mogadishu) | pharm.mog@pharmacy.so | Pharm@123 |
| Manager (Hargeisa) | manager.hgs@pharmacy.so | Manager@123 |

---

## PART 9: ONE-COMMAND SETUP

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/pharmacy-chain-inventory.git
cd pharmacy-chain-inventory

# Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm start          # runs on port 4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # runs on port 5173

# Run tests
cd backend
npm test           # 85 integration tests
```

---

## PART 10: KEY TALKING POINTS FOR 5-MIN PITCH

1. **Open with the problem:** "Pharmacy chains in Somalia lose money when medicine expires on one branch's shelf while another branch has run out."

2. **Show the solution:** "Medicap tracks every medicine at the batch level. When a cashier makes a sale, the system automatically sells from the batch expiring soonest — this is called FEFO."

3. **Prove concurrency:** "What happens when two cashiers sell the last unit at the same time? Let me run the test — exactly one succeeds, the other gets 'Out of stock'. Stock never goes negative."

4. **Show the transfer flow:** "When Mogadishu branch runs low on Amoxicillin but Hargeisa has surplus, a manager can request a transfer. The stock leaves the sender, enters transit, and arrives at the receiver with the same batch details."

5. **Show the dashboard:** "The owner sees real-time KPIs: total medicines, stock levels, expiry alerts, and profit per branch — all from real database queries, not hardcoded numbers."

6. **Close with Somali:** Switch to Somali language → show everything works in both languages.

---

**Ku guuleyso presentation-kaaga! / Good luck with your presentation!**

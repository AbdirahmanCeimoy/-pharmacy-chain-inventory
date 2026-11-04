// POS service — the core-25-points FEFO + concurrency logic.
//
// Flow per POST /api/pos/sales:
//   1. Validate payload (Zod)
//   2. Resolve branch + enforce branch access
//   3. Fetch each medicine row (price, is_controlled, is_active) in one query
//   4. Pre-tx guards:
//      - every medicine exists + is_active
//      - any is_controlled line: PHARMACIST required + prescription data present
//   5. Sort cart items by medicine_id ASC → deterministic lock order across concurrent sales
//   6. OPEN TRANSACTION (deadlock-aware retry)
//      For each cart item (in sorted order):
//        a. lockSellableFEFO(medicine, branch)  → rows locked, oldest-expiry first
//        b. Walk batches: take = min(remaining, batch.qty_on_hand)
//           - decrement(batch, take) with qty guard (never negative)
//           - record allocation { batchId, qty, unitCost }
//        c. If still remaining > 0 → ConflictError OUT_OF_STOCK → rollback
//      Insert sale shell with next receipt number (counter locked in same tx)
//      For each cart item:
//        - insert sale_item
//        - insert sale_batch_allocations (one per batch tapped)
//        - insert stock_movements SALE (one per batch tapped — the audit row)
//        - if controlled: compute post-sale balance, insert controlled_drug_register
//      Payment adapter charge — rollback if it fails
//   7. COMMIT
//   8. After commit: SMS to customer (best-effort, outside tx)
//   9. Return the full sale with items + allocations + batch snapshots
//
// Concurrency:
//   - lockSellableFEFO reads via FOR UPDATE → sees latest-committed qty
//   - Cart items locked in medicine_id order → no cross-item deadlock
//   - decrement has a qty_on_hand >= ? guard so the DB itself blocks negatives
//   - withTransaction retries on ER_LOCK_DEADLOCK / ER_LOCK_WAIT_TIMEOUT

import { z } from 'zod';
import { pool, withTransaction } from '../db/pool.js';
import * as batchRepo from '../repositories/batches.repo.js';
import * as salesRepo from '../repositories/sales.repo.js';
import * as cdrRepo from '../repositories/controlled_drugs.repo.js';
import * as movementRepo from '../repositories/stock_movements.repo.js';
import * as stockCountsRepo from '../repositories/stock_counts.repo.js';
import * as paymentAdapter from '../adapters/payment.adapter.js';
import * as smsAdapter from '../adapters/sms.adapter.js';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors.js';

const PAYMENT_METHODS = ['CASH', 'EVC_PLUS', 'ZAAD', 'E_DAHAB'];

const prescriptionSchema = z.object({
  prescription_number: z.string().trim().min(1).max(60),
  doctor_name: z.string().trim().min(1).max(100),
  patient_name: z.string().trim().min(1).max(100),
});

const cartItemSchema = z.object({
  medicine_id: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().positive().max(100_000),
  prescription: prescriptionSchema.optional(),
});

const saleSchema = z.object({
  branch_id: z.coerce.number().int().positive().optional(),
  payment_method: z.enum(PAYMENT_METHODS),
  customer_phone: z.string().trim().max(20).optional(),
  items: z.array(cartItemSchema).min(1).max(50),
});

function assertBranchAccess(actor, branchId) {
  if (actor.role === 'OWNER') return;
  if (Number(actor.branchId) !== Number(branchId)) {
    throw new ForbiddenError('You can only act on your own branch');
  }
}

export async function createSale(payload, actor) {
  const parsed = saleSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid sale payload', parsed.error.flatten().fieldErrors);
  }
  const branchId = parsed.data.branch_id ?? actor.branchId;
  if (!branchId) {
    throw new ValidationError('branch_id is required (OWNER must pick one)');
  }
  assertBranchAccess(actor, branchId);

  // Fetch medicine info up front (one query).
  const medIds = [...new Set(parsed.data.items.map((i) => i.medicine_id))];
  const [meds] = await pool.query(
    `SELECT id, generic_name, brand_name, selling_price, is_controlled, is_active
       FROM medicines
      WHERE id IN (?)`,
    [medIds]
  );
  const medsById = new Map(meds.map((m) => [m.id, m]));

  // Pre-tx validation: medicine exists, active; controlled → PHARMACIST + prescription.
  for (const item of parsed.data.items) {
    const med = medsById.get(item.medicine_id);
    if (!med) {
      throw new ValidationError(`Medicine ${item.medicine_id} not found`);
    }
    if (!med.is_active) {
      throw new ConflictError(`Medicine ${med.generic_name} (${med.brand_name}) is inactive`, {
        medicineId: med.id,
      });
    }
    if (med.is_controlled) {
      if (actor.role !== 'PHARMACIST') {
        throw new ForbiddenError(
          `Only PHARMACIST can sell controlled drug ${med.generic_name} (${med.brand_name})`
        );
      }
      if (!item.prescription) {
        throw new ValidationError(
          `Controlled drug ${med.generic_name} requires prescription_number, doctor_name, patient_name`,
          { field: 'prescription', medicineId: med.id }
        );
      }
    }
  }

  // Sort for deterministic cross-item lock order.
  const sortedItems = [...parsed.data.items].sort((a, b) => a.medicine_id - b.medicine_id);

  const result = await withTransaction(
    async (conn) => {
      // Feature 11: block sales for any medicine currently under an
      // IN_PROGRESS stock count at this branch.
      const blocked = await stockCountsRepo.medicinesBlockedByCount(conn, branchId, medIds);
      if (blocked.size > 0) {
        const names = [...blocked]
          .map((id) => {
            const m = medsById.get(id);
            return m ? `${m.generic_name} (${m.brand_name})` : `#${id}`;
          })
          .join(', ');
        throw new ConflictError(`Sales blocked — a stock count is in progress for: ${names}`, {
          code: 'COUNT_IN_PROGRESS',
          medicineIds: [...blocked],
        });
      }

      const perItem = [];

      for (const item of sortedItems) {
        const med = medsById.get(item.medicine_id);
        const unitPrice = Number(med.selling_price);

        const batches = await batchRepo.lockSellableFEFO(conn, item.medicine_id, branchId);
        let remaining = item.qty;
        const allocations = [];

        for (const b of batches) {
          if (remaining <= 0) break;
          const available = Number(b.qty_on_hand);
          const take = Math.min(remaining, available);
          await batchRepo.decrement(conn, b.id, take);
          allocations.push({ batchId: b.id, qty: take, unitCost: Number(b.unit_cost) });
          remaining -= take;
        }

        if (remaining > 0) {
          const available = item.qty - remaining;
          throw new ConflictError(
            `Out of stock for ${med.generic_name} (${med.brand_name}) — requested ${item.qty}, available ${available}`,
            {
              code: 'OUT_OF_STOCK',
              medicineId: item.medicine_id,
              requested: item.qty,
              available,
            }
          );
        }

        perItem.push({
          item,
          med,
          allocations,
          unitPrice,
          lineTotal: Number((unitPrice * item.qty).toFixed(2)),
        });
      }

      const receiptNo = await salesRepo.nextReceiptNumber(conn, branchId);
      const subtotal = Number(perItem.reduce((sum, p) => sum + p.lineTotal, 0).toFixed(2));

      const saleId = await salesRepo.insertSale(conn, {
        receipt_no: receiptNo,
        branch_id: branchId,
        cashier_id: actor.id,
        payment_method: parsed.data.payment_method,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
      });

      for (const p of perItem) {
        const saleItemId = await salesRepo.insertSaleItem(conn, {
          sale_id: saleId,
          medicine_id: p.item.medicine_id,
          qty: p.item.qty,
          unit_price: p.unitPrice.toFixed(2),
          line_total: p.lineTotal.toFixed(2),
        });

        for (const alloc of p.allocations) {
          await salesRepo.insertAllocation(conn, {
            sale_item_id: saleItemId,
            batch_id: alloc.batchId,
            qty: alloc.qty,
            unit_cost: alloc.unitCost.toFixed(2),
          });
          await movementRepo.insertOne(conn, {
            batch_id: alloc.batchId,
            medicine_id: p.item.medicine_id,
            branch_id: branchId,
            qty_delta: -alloc.qty,
            movement_type: 'SALE',
            reference_type: 'SALE',
            reference_id: saleId,
            performed_by: actor.id,
            note: `Receipt ${receiptNo}`,
          });
        }

        if (p.med.is_controlled) {
          const balance = await cdrRepo.currentBalance(conn, p.item.medicine_id, branchId);
          await cdrRepo.insertRegister(conn, {
            sale_id: saleId,
            medicine_id: p.item.medicine_id,
            batch_id: p.allocations[0].batchId,
            qty: p.item.qty,
            prescription_number: p.item.prescription.prescription_number,
            doctor_name: p.item.prescription.doctor_name,
            patient_name: p.item.prescription.patient_name,
            pharmacist_id: actor.id,
            running_balance: balance,
          });
        }
      }

      // Payment mock — if this ever fails we rollback the entire sale.
      const payment = await paymentAdapter.charge({
        amount: subtotal,
        method: parsed.data.payment_method,
      });
      if (payment.status !== 'ok') {
        throw new ConflictError('Payment failed', { paymentMethod: parsed.data.payment_method });
      }

      return { saleId, receiptNo, subtotal };
    },
    { maxRetries: 3 }
  );

  // Best-effort SMS outside the tx — a failure here never undoes the sale.
  if (parsed.data.customer_phone) {
    smsAdapter
      .send(
        parsed.data.customer_phone,
        `Receipt ${result.receiptNo} — $${result.subtotal.toFixed(2)}. Thank you.`
      )
      .catch(() => {});
  }

  return getById(result.saleId, actor);
}

export async function getById(id, actor) {
  const sale = await salesRepo.findById(id);
  if (!sale) throw new NotFoundError('Sale not found');
  if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(sale.branch_id)) {
    throw new ForbiddenError();
  }
  const [items, allocations] = await Promise.all([
    salesRepo.findItemsBySaleId(id),
    salesRepo.findAllocationsBySaleId(id),
  ]);
  const allocsByItem = new Map();
  for (const a of allocations) {
    const arr = allocsByItem.get(a.sale_item_id) || [];
    arr.push({
      id: a.id,
      batchId: a.batch_id,
      batchNumber: a.batch_number,
      expiryDate: a.expiry_date,
      qty: Number(a.qty),
      unitCost: a.unit_cost,
    });
    allocsByItem.set(a.sale_item_id, arr);
  }
  return {
    id: sale.id,
    receiptNo: sale.receipt_no,
    branchId: sale.branch_id,
    branchCode: sale.branch_code,
    branchName: sale.branch_name,
    branchPhone: sale.branch_phone,
    branchAddress: sale.branch_address,
    cashierId: sale.cashier_id,
    cashierName: sale.cashier_name,
    paymentMethod: sale.payment_method,
    subtotal: sale.subtotal,
    total: sale.total,
    status: sale.status,
    createdAt: sale.created_at,
    items: items.map((i) => ({
      id: i.id,
      medicineId: i.medicine_id,
      medicine: {
        genericName: i.generic_name,
        brandName: i.brand_name,
        form: i.form,
        strength: i.strength,
        unitLabel: i.unit_label,
        isControlled: !!i.is_controlled,
      },
      qty: Number(i.qty),
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      allocations: allocsByItem.get(i.id) || [],
    })),
  };
}

export async function findByReceiptNo(branchId, receiptNo, actor) {
  const sale = await salesRepo.findByReceipt(branchId, receiptNo);
  if (!sale) return null;
  if (actor.role !== 'OWNER' && Number(actor.branchId) !== Number(sale.branch_id)) {
    throw new ForbiddenError();
  }
  return getById(sale.id, actor);
}

export async function list(query, actor) {
  const filters = { limit: Number(query?.limit) || 50, offset: Number(query?.offset) || 0 };
  if (actor.role === 'OWNER') {
    if (query?.branchId) filters.branchId = Number(query.branchId);
  } else {
    filters.branchId = actor.branchId;
  }
  const rows = await salesRepo.list(filters);
  return rows.map((s) => ({
    id: s.id,
    receiptNo: s.receipt_no,
    branchId: s.branch_id,
    branchCode: s.branch_code,
    cashierId: s.cashier_id,
    cashierName: s.cashier_name,
    paymentMethod: s.payment_method,
    subtotal: s.subtotal,
    total: s.total,
    status: s.status,
    createdAt: s.created_at,
  }));
}

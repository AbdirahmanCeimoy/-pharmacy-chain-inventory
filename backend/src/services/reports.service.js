// Reports service.
//   profitByBranch: revenue − cost per period (day or month), honest batch-cost
//     accounting via sale_batch_allocations (never averaging). Returns from the
//     window are netted off BOTH revenue and cost on the original sale's period
//     (brief: "returns reduce both revenue and cost").
//   expiryLossByBranch: sum of (qty × unit_cost) for EXPIRED and WRITE_OFF
//     stock_movements, grouped by month × branch.
//   topMedicinesLost: top-10 medicines by total expiry/write-off value.
//
// Branch scoping: OWNER may pass ?branchId or omit for all. MANAGER/PHARMACIST
// are forced onto their own branch.

import { pool } from '../db/pool.js';
import { ValidationError } from '../utils/errors.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function iso(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function defaultWindow() {
  const end = startOfToday();
  end.setDate(end.getDate() + 1); // include today fully
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { from: iso(start), to: iso(end) };
}

function resolveBranch(query, actor) {
  if (actor.role === 'OWNER') {
    return query?.branchId ? Number(query.branchId) : null;
  }
  return actor.branchId;
}

function resolveWindow(query) {
  const w = defaultWindow();
  if (query?.from) w.from = `${query.from} 00:00:00`;
  if (query?.to) w.to = `${query.to} 23:59:59`;
  return w;
}

// -------- profit per branch --------

export async function profitByBranch(query, actor) {
  const groupBy = (query?.groupBy || 'day') === 'month' ? 'month' : 'day';
  const branchId = resolveBranch(query, actor);
  const { from, to } = resolveWindow(query);
  const periodExpr =
    groupBy === 'month' ? "DATE_FORMAT(s.created_at, '%Y-%m')" : 'DATE(s.created_at)';

  const branchFilter = branchId ? 'AND s.branch_id = ?' : '';
  const params = [from, to];
  if (branchId) params.push(branchId);

  const [grossRows] = await pool.query(
    `SELECT ${periodExpr} AS period,
            s.branch_id, br.code AS branch_code,
            COALESCE(SUM(si.line_total), 0)             AS revenue,
            COALESCE(SUM(sba.qty * sba.unit_cost), 0)   AS cost
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN sale_batch_allocations sba ON sba.sale_item_id = si.id
       JOIN branches br ON br.id = s.branch_id
      WHERE s.status = 'COMPLETED'
        AND s.created_at BETWEEN ? AND ?
        ${branchFilter}
      GROUP BY period, s.branch_id, br.code
      ORDER BY period ASC, br.code ASC`,
    params
  );

  const [returnRows] = await pool.query(
    `SELECT ${periodExpr} AS period,
            s.branch_id, br.code AS branch_code,
            COALESCE(SUM(ri.qty * si.unit_price), 0)   AS revenue_credit,
            COALESCE(SUM(ri.qty * b.unit_cost), 0)     AS cost_credit
       FROM return_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN sales s ON s.id = si.sale_id
       JOIN batches b ON b.id = ri.batch_id
       JOIN branches br ON br.id = s.branch_id
      WHERE s.created_at BETWEEN ? AND ?
        ${branchFilter}
      GROUP BY period, s.branch_id, br.code
      ORDER BY period ASC, br.code ASC`,
    params
  );

  const key = (r) => `${r.period}|${r.branch_id}`;
  const byKey = new Map();
  for (const r of grossRows) {
    byKey.set(key(r), {
      period: String(r.period),
      branchId: r.branch_id,
      branchCode: r.branch_code,
      revenue: Number(r.revenue),
      cost: Number(r.cost),
    });
  }
  for (const r of returnRows) {
    const k = key(r);
    const existing = byKey.get(k) || {
      period: String(r.period),
      branchId: r.branch_id,
      branchCode: r.branch_code,
      revenue: 0,
      cost: 0,
    };
    existing.revenue -= Number(r.revenue_credit);
    existing.cost -= Number(r.cost_credit);
    byKey.set(k, existing);
  }

  const rows = [...byKey.values()].map((r) => ({
    ...r,
    revenue: Number(r.revenue.toFixed(2)),
    cost: Number(r.cost.toFixed(2)),
    profit: Number((r.revenue - r.cost).toFixed(2)),
  }));
  rows.sort((a, b) => (a.period > b.period ? 1 : a.period < b.period ? -1 : 0));

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cost: acc.cost + r.cost,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );

  return {
    from,
    to,
    groupBy,
    branchId,
    rows,
    totals: {
      revenue: Number(totals.revenue.toFixed(2)),
      cost: Number(totals.cost.toFixed(2)),
      profit: Number(totals.profit.toFixed(2)),
    },
  };
}

// -------- dashboard summary --------
// One round-trip for the home screen: today's revenue + units, counts for
// low-stock and near-expiry batches, pending POs (OWNER only), 7-day trend
// and short alert lists. Branch is scoped by role the same way every other
// report is.

export async function dashboardSummary(actor) {
  const branchId = actor.role === 'OWNER' ? null : actor.branchId;
  const branchFilter = branchId ? 'AND branch_id = ?' : '';
  const branchJoinFilter = branchId ? 'AND b.branch_id = ?' : '';
  const branchSalesFilter = branchId ? 'AND s.branch_id = ?' : '';

  // Today's sales — revenue and units.
  const [[today]] = await pool.query(
    `SELECT COALESCE(SUM(s.total), 0) AS revenue,
            COALESCE(SUM(si.qty), 0) AS units
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.created_at) = CURDATE()
        ${branchSalesFilter}`,
    branchId ? [branchId] : []
  );

  // Low-stock medicines — inline version of reorder.suggestions count. OWNER
  // sees the figure summed across every branch; MANAGER/PHARMACIST only their own.
  const [[lowStock]] = await pool.query(
    `SELECT COUNT(*) AS count FROM (
       SELECT m.id, br.id AS branch_id,
              COALESCE((
                SELECT SUM(b.qty_on_hand) FROM batches b
                 WHERE b.medicine_id = m.id AND b.branch_id = br.id
                   AND b.expiry_date > CURDATE() AND b.is_blocked = 0
              ), 0) AS stock,
              COALESCE((
                SELECT SUM(si.qty) / 30.0 FROM sale_items si
                 JOIN sales s ON s.id = si.sale_id
                WHERE si.medicine_id = m.id AND s.branch_id = br.id
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              ), 0) AS avg_daily
         FROM medicines m
         JOIN branches br ON ${branchId ? 'br.id = ?' : '1=1'}
        WHERE m.is_active = 1
         HAVING avg_daily > 0 AND (stock / avg_daily) < 14
     ) AS t`,
    branchId ? [branchId] : []
  );

  // Batches expiring in the next 30 days with qty still on hand.
  const [[expiring]] = await pool.query(
    `SELECT COUNT(*) AS count,
            COALESCE(SUM(qty_on_hand * unit_cost), 0) AS value
       FROM batches
      WHERE qty_on_hand > 0
        AND is_blocked = 0
        AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ${branchFilter}`,
    branchId ? [branchId] : []
  );

  // Purchase orders awaiting the next step: SUBMITTED needs HQ approval,
  // APPROVED / PARTIALLY_RECEIVED still needs fulfilment.
  const [[pendingPos]] = await pool.query(
    `SELECT COUNT(*) AS count
       FROM purchase_orders
      WHERE status IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED')
        ${branchFilter}`,
    branchId ? [branchId] : []
  );

  // 7-day revenue + cost trend for a line chart on the home page.
  const [trendRows] = await pool.query(
    `SELECT DATE(s.created_at) AS period,
            COALESCE(SUM(si.line_total), 0)           AS revenue,
            COALESCE(SUM(sba.qty * sba.unit_cost), 0) AS cost
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN sale_batch_allocations sba ON sba.sale_item_id = si.id
      WHERE s.status = 'COMPLETED'
        AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        ${branchSalesFilter}
      GROUP BY period
      ORDER BY period ASC`,
    branchId ? [branchId] : []
  );

  // Fill in zero rows for days with no sales so the chart has 7 x-axis points.
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = trendRows.find((r) => String(r.period).slice(0, 10) === key);
    const revenue = hit ? Number(hit.revenue) : 0;
    const cost = hit ? Number(hit.cost) : 0;
    trend.push({
      date: key,
      revenue: Number(revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      profit: Number((revenue - cost).toFixed(2)),
    });
  }

  // Alert lists — small, soonest first.
  const [expiringList] = await pool.query(
    `SELECT b.id, b.batch_number, b.expiry_date, b.qty_on_hand,
            m.generic_name, m.strength, m.form,
            br.name AS branch_name, br.code AS branch_code,
            DATEDIFF(b.expiry_date, CURDATE()) AS days_left
       FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       JOIN branches br ON br.id = b.branch_id
      WHERE b.qty_on_hand > 0
        AND b.is_blocked = 0
        AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ${branchJoinFilter}
      ORDER BY b.expiry_date ASC
      LIMIT 5`,
    branchId ? [branchId] : []
  );

  const [pendingList] = await pool.query(
    `SELECT po.id, po.po_number, po.status, po.total_amount,
            s.name AS supplier_name, br.name AS branch_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
      WHERE po.status IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED')
        ${branchId ? 'AND po.branch_id = ?' : ''}
      ORDER BY po.created_at ASC
      LIMIT 5`,
    branchId ? [branchId] : []
  );

  return {
    scope: { branchId, role: actor.role },
    kpis: {
      todayRevenue: Number(Number(today.revenue).toFixed(2)),
      todayUnits: Number(today.units),
      lowStockCount: Number(lowStock.count),
      expiringCount: Number(expiring.count),
      expiringValue: Number(Number(expiring.value).toFixed(2)),
      pendingPoCount: Number(pendingPos.count),
    },
    trend,
    alerts: {
      expiring: expiringList.map((r) => ({
        batchId: r.id,
        batchNumber: r.batch_number,
        expiryDate: r.expiry_date,
        qtyOnHand: Number(r.qty_on_hand),
        daysLeft: Number(r.days_left),
        medicine: `${r.generic_name} ${r.strength} ${r.form}`,
        branchName: r.branch_name,
        branchCode: r.branch_code,
      })),
      pendingPos: pendingList.map((r) => ({
        poId: r.id,
        poNumber: r.po_number,
        status: r.status,
        totalAmount: Number(r.total_amount),
        supplierName: r.supplier_name,
        branchName: r.branch_name,
      })),
    },
  };
}

// -------- expiry loss --------

export async function expiryLoss(query, actor) {
  const branchId = resolveBranch(query, actor);
  const { from, to } = resolveWindow(query);
  const branchFilter = branchId ? 'AND sm.branch_id = ?' : '';
  const params = [from, to];
  if (branchId) params.push(branchId);

  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(sm.created_at, '%Y-%m') AS month,
            sm.branch_id, br.code AS branch_code,
            COALESCE(SUM(ABS(sm.qty_delta) * b.unit_cost), 0) AS loss_value,
            COALESCE(SUM(ABS(sm.qty_delta)), 0)               AS loss_qty
       FROM stock_movements sm
       JOIN batches b ON b.id = sm.batch_id
       JOIN branches br ON br.id = sm.branch_id
      WHERE sm.movement_type IN ('EXPIRED', 'WRITE_OFF')
        AND sm.created_at BETWEEN ? AND ?
        ${branchFilter}
      GROUP BY month, sm.branch_id, br.code
      ORDER BY month DESC, br.code ASC`,
    params
  );

  const [topRows] = await pool.query(
    `SELECT sm.medicine_id,
            m.generic_name, m.brand_name, m.form, m.strength,
            COALESCE(SUM(ABS(sm.qty_delta) * b.unit_cost), 0) AS loss_value,
            COALESCE(SUM(ABS(sm.qty_delta)), 0)               AS loss_qty
       FROM stock_movements sm
       JOIN batches b ON b.id = sm.batch_id
       JOIN medicines m ON m.id = sm.medicine_id
      WHERE sm.movement_type IN ('EXPIRED', 'WRITE_OFF')
        AND sm.created_at BETWEEN ? AND ?
        ${branchFilter}
      GROUP BY sm.medicine_id, m.generic_name, m.brand_name, m.form, m.strength
      ORDER BY loss_value DESC
      LIMIT 10`,
    params
  );

  const monthly = rows.map((r) => ({
    month: r.month,
    branchId: r.branch_id,
    branchCode: r.branch_code,
    lossQty: Number(r.loss_qty),
    lossValue: Number(Number(r.loss_value).toFixed(2)),
  }));
  const top10 = topRows.map((r) => ({
    medicineId: r.medicine_id,
    genericName: r.generic_name,
    brandName: r.brand_name,
    form: r.form,
    strength: r.strength,
    lossQty: Number(r.loss_qty),
    lossValue: Number(Number(r.loss_value).toFixed(2)),
  }));
  const total = {
    qty: monthly.reduce((s, m) => s + m.lossQty, 0),
    value: Number(monthly.reduce((s, m) => s + m.lossValue, 0).toFixed(2)),
  };

  return { from, to, branchId, monthly, top10, total };
}

// Reorder suggestions. Query-only (no new tables).
//   For each active medicine in a branch:
//     - current_stock = sum of qty_on_hand across non-expired batches
//     - avg_daily    = (qty sold in last 30 days) / 30
//     - days_cover   = current_stock / avg_daily
//   Suggest the medicine only when:
//     - avg_daily > 0 (brief: "no sales in 30 days → not suggested")
//     - days_cover < 14 (brief threshold)
//   Suggested qty = CEIL(avg_daily * 30) — enough for a full 30-day cover.

import { pool } from '../db/pool.js';
import { ValidationError } from '../utils/errors.js';

export async function suggestions(query, actor) {
  const branchId =
    actor.role === 'OWNER' ? (query?.branchId ? Number(query.branchId) : null) : actor.branchId;
  if (!branchId) {
    throw new ValidationError('branchId is required (OWNER must pick one)');
  }

  // Both subqueries scoped to this branch. LEFT JOIN batches so a medicine with
  // zero stock still appears if it's selling (days_cover = 0).
  const [rows] = await pool.query(
    `SELECT m.id AS medicine_id,
            m.generic_name, m.brand_name, m.form, m.strength, m.unit_label, m.selling_price,
            COALESCE((
              SELECT SUM(b.qty_on_hand) FROM batches b
               WHERE b.medicine_id = m.id AND b.branch_id = ?
                 AND b.expiry_date > CURDATE() AND b.is_blocked = 0
            ), 0) AS current_stock,
            COALESCE((
              SELECT SUM(si.qty) / 30.0 FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
               WHERE si.medicine_id = m.id
                 AND s.branch_id = ?
                 AND s.status = 'COMPLETED'
                 AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ), 0) AS avg_daily
       FROM medicines m
      WHERE m.is_active = 1
      HAVING avg_daily > 0
        AND (current_stock / avg_daily) < 14
      ORDER BY (current_stock / avg_daily) ASC`,
    [branchId, branchId]
  );

  return {
    branchId,
    items: rows.map((r) => {
      const avgDaily = Number(r.avg_daily);
      const currentStock = Number(r.current_stock);
      const daysCover = avgDaily > 0 ? currentStock / avgDaily : null;
      const suggestedQty = Math.ceil(avgDaily * 30);
      return {
        medicineId: r.medicine_id,
        medicine: {
          genericName: r.generic_name,
          brandName: r.brand_name,
          form: r.form,
          strength: r.strength,
          unitLabel: r.unit_label,
        },
        currentStock,
        avgDaily: Number(avgDaily.toFixed(2)),
        daysCover: daysCover == null ? null : Number(daysCover.toFixed(1)),
        suggestedQty,
        suggestedCost: Number((suggestedQty * Number(r.selling_price)).toFixed(2)),
      };
    }),
  };
}

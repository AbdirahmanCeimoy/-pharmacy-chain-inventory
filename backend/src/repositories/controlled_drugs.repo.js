// Controlled-drug register. Append-only. The DB triggers from migration 007 block
// any UPDATE or DELETE even if the app ever tried — tested in the trigger test.

import { pool } from '../db/pool.js';

// Called inside the sale transaction AFTER batches have been deducted, so the
// SUM reflects the post-sale balance.
export async function currentBalance(conn, medicineId, branchId) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(SUM(qty_on_hand), 0) AS balance
       FROM batches
      WHERE medicine_id = ? AND branch_id = ?`,
    [medicineId, branchId]
  );
  return Number(rows[0].balance);
}

export async function insertRegister(conn, data) {
  await conn.execute(
    `INSERT INTO controlled_drug_register
       (sale_id, medicine_id, batch_id, qty, prescription_number, doctor_name,
        patient_name, pharmacist_id, running_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.sale_id,
      data.medicine_id,
      data.batch_id,
      data.qty,
      data.prescription_number,
      data.doctor_name,
      data.patient_name,
      data.pharmacist_id,
      data.running_balance,
    ]
  );
}

export async function listForMedicine(medicineId, { limit = 100 } = {}) {
  const [rows] = await pool.query(
    `SELECT id, sale_id, medicine_id, batch_id, qty, prescription_number,
            doctor_name, patient_name, pharmacist_id, running_balance, created_at
       FROM controlled_drug_register
      WHERE medicine_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [medicineId, Number(limit)]
  );
  return rows;
}

-- 007_triggers.sql
-- Immutability at the database layer for controlled_drug_register.
-- The service layer already never UPDATEs/DELETEs this table; these triggers make it
-- impossible even if someone later writes bad code or opens phpMyAdmin.
-- Single-statement trigger body means no DELIMITER / BEGIN...END needed.

CREATE TRIGGER trg_cdr_no_update
BEFORE UPDATE ON controlled_drug_register
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only';

CREATE TRIGGER trg_cdr_no_delete
BEFORE DELETE ON controlled_drug_register
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'controlled_drug_register is append-only';

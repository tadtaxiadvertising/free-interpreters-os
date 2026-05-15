-- Add Dominican Bank Transfer fields to interpreters table
ALTER TABLE "interpreters"
  ADD COLUMN "banco" TEXT,
  ADD COLUMN "tipo_cuenta" TEXT,
  ADD COLUMN "cedula_rnc" TEXT,
  ALTER COLUMN "metodo_pago" SET DEFAULT 'Transferencia Bancaria';

-- Change the notes column type to TEXT if needed (from VARCHAR)
ALTER TABLE "interpreters" 
  ALTER COLUMN "notas" TYPE TEXT;

-- Add details text field to PayrateAuditLog for expanded audit records
ALTER TABLE "payrate_audit_log"
  ADD COLUMN "details" TEXT;

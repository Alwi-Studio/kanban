-- Generalize automation_rules from a single "label added -> move column" rule
-- into a trigger + actions engine.

-- New columns (trigger_type gets a temporary default so existing rows stay valid)
ALTER TABLE "automation_rules" ADD COLUMN "trigger_type" TEXT NOT NULL DEFAULT 'LABEL_ADDED';
ALTER TABLE "automation_rules" ADD COLUMN "trigger_label_id" TEXT;
ALTER TABLE "automation_rules" ADD COLUMN "trigger_column_id" TEXT;
ALTER TABLE "automation_rules" ADD COLUMN "add_label_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "automation_rules" ADD COLUMN "remove_label_ids" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing rules: they were "when label added -> move to target column"
UPDATE "automation_rules" SET "trigger_label_id" = "label_id";

-- Drop the old label trigger column, its FK, unique + index
ALTER TABLE "automation_rules" DROP CONSTRAINT "automation_rules_label_id_fkey";
DROP INDEX "automation_rules_board_id_label_id_key";
DROP INDEX "automation_rules_label_id_enabled_idx";
ALTER TABLE "automation_rules" DROP COLUMN "label_id";

-- target_column_id is now optional (a rule may only add/remove labels)
ALTER TABLE "automation_rules" DROP CONSTRAINT "automation_rules_target_column_id_fkey";
ALTER TABLE "automation_rules" ALTER COLUMN "target_column_id" DROP NOT NULL;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_target_column_id_fkey" FOREIGN KEY ("target_column_id") REFERENCES "columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New trigger FKs
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_trigger_label_id_fkey" FOREIGN KEY ("trigger_label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_trigger_column_id_fkey" FOREIGN KEY ("trigger_column_id") REFERENCES "columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New indexes
CREATE INDEX "automation_rules_board_id_enabled_idx" ON "automation_rules"("board_id", "enabled");
CREATE INDEX "automation_rules_trigger_type_enabled_idx" ON "automation_rules"("trigger_type", "enabled");

-- Drop the temporary default now that all rows have a real trigger_type
ALTER TABLE "automation_rules" ALTER COLUMN "trigger_type" DROP DEFAULT;

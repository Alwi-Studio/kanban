-- Make automation rules fully customizable: optional name, JSON condition list,
-- JSON action list. The old typed action columns are folded into "actions".

ALTER TABLE "automation_rules" ADD COLUMN "name" TEXT;
ALTER TABLE "automation_rules" ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "automation_rules" ADD COLUMN "actions" JSONB NOT NULL DEFAULT '[]';

-- Backfill actions from the previous add/remove-label + move columns
UPDATE "automation_rules" SET "actions" =
    (CASE WHEN coalesce(array_length("add_label_ids", 1), 0) > 0
          THEN jsonb_build_array(jsonb_build_object('type', 'ADD_LABELS', 'labelIds', to_jsonb("add_label_ids")))
          ELSE '[]'::jsonb END)
  ||
    (CASE WHEN coalesce(array_length("remove_label_ids", 1), 0) > 0
          THEN jsonb_build_array(jsonb_build_object('type', 'REMOVE_LABELS', 'labelIds', to_jsonb("remove_label_ids")))
          ELSE '[]'::jsonb END)
  ||
    (CASE WHEN "target_column_id" IS NOT NULL
          THEN jsonb_build_array(jsonb_build_object('type', 'MOVE_TO_COLUMN', 'columnId', "target_column_id"))
          ELSE '[]'::jsonb END);

-- Drop the old typed action columns (now represented inside "actions")
ALTER TABLE "automation_rules" DROP CONSTRAINT "automation_rules_target_column_id_fkey";
ALTER TABLE "automation_rules" DROP COLUMN "target_column_id";
ALTER TABLE "automation_rules" DROP COLUMN "add_label_ids";
ALTER TABLE "automation_rules" DROP COLUMN "remove_label_ids";

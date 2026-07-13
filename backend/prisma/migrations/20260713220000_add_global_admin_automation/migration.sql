ALTER TABLE "users" ADD COLUMN "is_global_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "completed_at" TIMESTAMP(3);

UPDATE "users"
SET "is_global_admin" = true
WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);

UPDATE "tasks" AS task
SET "completed_at" = CURRENT_TIMESTAMP
FROM "columns" AS col
WHERE task."column_id" = col."id"
  AND LOWER(col."name") IN ('done', 'completed', 'complete', 'selesai');

CREATE TABLE "automation_rules" (
  "id" TEXT NOT NULL,
  "board_id" TEXT NOT NULL,
  "label_id" TEXT NOT NULL,
  "target_column_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_rules_board_id_label_id_key" ON "automation_rules"("board_id", "label_id");
CREATE INDEX "automation_rules_label_id_enabled_idx" ON "automation_rules"("label_id", "enabled");

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_target_column_id_fkey" FOREIGN KEY ("target_column_id") REFERENCES "columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

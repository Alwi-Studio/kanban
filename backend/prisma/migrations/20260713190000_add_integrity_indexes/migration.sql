-- Remove duplicate memberships/assignees left by earlier race conditions.
DELETE FROM "board_members" a
USING "board_members" b
WHERE a."id" > b."id"
  AND a."board_id" = b."board_id"
  AND a."user_id" = b."user_id";

DELETE FROM "task_assignees" a
USING "task_assignees" b
WHERE a."id" > b."id"
  AND a."task_id" = b."task_id"
  AND a."user_id" = b."user_id";

CREATE UNIQUE INDEX "board_members_board_id_user_id_key"
ON "board_members"("board_id", "user_id");

CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key"
ON "task_assignees"("task_id", "user_id");

CREATE INDEX "columns_board_id_position_idx"
ON "columns"("board_id", "position");

CREATE INDEX "tasks_column_id_position_idx"
ON "tasks"("column_id", "position");

CREATE INDEX "notifications_user_id_is_read_created_at_idx"
ON "notifications"("user_id", "is_read", "created_at");

import { Router } from "express";
import { z } from "zod";
import * as taskController from "../controllers/tasks";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";
import { upload } from "../middlewares/upload";

export const taskRouter = Router();

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  position: z.number().int().optional(),
  column_id: z.string().uuid().optional(),
  due_date: z.string().datetime().nullable().optional(),
  version: z.number().int().optional(),
});

const assigneeSchema = z.object({
  user_id: z.string().uuid(),
});

taskRouter.patch("/:id", authenticate, requireRole("admin", "owner", "member")("task"), validate(updateTaskSchema), taskController.updateTask);
taskRouter.delete("/:id", authenticate, requireRole("admin", "owner", "member")("task"), taskController.deleteTask);

taskRouter.post("/:id/assignees", authenticate, validate(assigneeSchema), taskController.addAssignee);
taskRouter.delete("/:id/assignees/:userId", authenticate, taskController.removeAssignee);

taskRouter.get("/:id/comments", authenticate, taskController.getComments);
taskRouter.post("/:id/comments", authenticate, taskController.addComment);

taskRouter.get("/:id/attachments", authenticate, taskController.getAttachments);
taskRouter.post("/:id/attachments", authenticate, upload.single("file"), taskController.addAttachment);

taskRouter.post("/:id/labels/:labelId", authenticate, taskController.addLabelToTask);
taskRouter.delete("/:id/labels/:labelId", authenticate, taskController.removeLabelFromTask);

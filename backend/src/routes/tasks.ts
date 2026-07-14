import { Router } from "express";
import { z } from "zod";
import * as taskController from "../controllers/tasks";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";
import { upload } from "../middlewares/upload";

export const taskRouter = Router();

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  position: z.number().int().optional(),
  column_id: z.string().uuid().optional(),
  due_date: z.string().datetime().nullable().optional(),
  version: z.number().int().optional(),
  completed: z.boolean().optional(),
});

const assigneeSchema = z.object({
  user_id: z.string().uuid(),
});

const commentSchema = z.object({ content: z.string().trim().min(1).max(5000) });

const canViewTask = requireRole("admin", "owner", "pm", "member", "viewer")("task");
const canEditTask = requireRole("admin", "owner", "pm", "member")("task");

taskRouter.patch("/:id", authenticate, canEditTask, validate(updateTaskSchema), taskController.updateTask);
taskRouter.delete("/:id", authenticate, canEditTask, taskController.deleteTask);

taskRouter.post("/:id/assignees", authenticate, canEditTask, validate(assigneeSchema), taskController.addAssignee);
taskRouter.delete("/:id/assignees/:userId", authenticate, canEditTask, taskController.removeAssignee);

taskRouter.get("/:id/comments", authenticate, canViewTask, taskController.getComments);
taskRouter.post("/:id/comments", authenticate, canEditTask, validate(commentSchema), taskController.addComment);

taskRouter.get("/:id/attachments", authenticate, canViewTask, taskController.getAttachments);
taskRouter.post("/:id/attachments", authenticate, canEditTask, upload.single("file"), taskController.addAttachment);

taskRouter.post("/:id/labels/:labelId", authenticate, canEditTask, taskController.addLabelToTask);
taskRouter.delete("/:id/labels/:labelId", authenticate, canEditTask, taskController.removeLabelFromTask);

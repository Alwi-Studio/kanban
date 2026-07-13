import { Router } from "express";
import { z } from "zod";
import * as columnController from "../controllers/columns";
import * as taskController from "../controllers/tasks";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";

export const columnRouter = Router();

const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().optional(),
});

columnRouter.patch("/:id", authenticate, requireRole("admin", "owner")("column"), validate(updateColumnSchema), columnController.updateColumn);
columnRouter.delete("/:id", authenticate, requireRole("admin", "owner")("column"), columnController.deleteColumn);

// Tasks nested under columns
columnRouter.post("/:id/tasks", authenticate, requireRole("admin", "owner", "pm", "member")("column"), taskController.createTask);

import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import * as boardController from "../controllers/boards";
import * as columnController from "../controllers/columns";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";
import { emitBoardEvent } from "../sockets";
import { AppError } from "../middlewares/errorHandler";


export const boardRouter = Router();

const createBoardSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const createColumnSchema = z.object({ name: z.string().trim().min(1).max(100) });
const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid label color"),
});

boardRouter.get("/", authenticate, boardController.listBoards);
boardRouter.post("/", authenticate, validate(createBoardSchema), boardController.createBoard);
boardRouter.get("/:id", authenticate, boardController.getBoard);
boardRouter.patch("/:id", authenticate, requireRole("admin", "owner")(), validate(updateBoardSchema), boardController.updateBoard);
boardRouter.delete("/:id", authenticate, requireRole("admin", "owner")(), boardController.deleteBoard);

boardRouter.post("/:id/columns", authenticate, requireRole("admin", "owner")(), validate(createColumnSchema), columnController.createColumn);

boardRouter.get("/:id/labels", authenticate, requireRole("admin", "owner", "pm", "member", "viewer")(), async (req, res, next) => {
  try {
    const labels = await prisma.label.findMany({ where: { boardId: req.params.id } });
    res.json(labels);
  } catch (err) { next(err); }
});

boardRouter.post("/:id/labels", authenticate, requireRole("admin", "owner")(), validate(createLabelSchema), async (req, res, next) => {
  try {
    const { name, color_hex } = req.body;
    const label = await prisma.label.create({
      data: { boardId: req.params.id, name, colorHex: color_hex },
    });
    emitBoardEvent(req.params.id, "label:created", label);
    res.status(201).json(label);
  } catch (err) { next(err); }
});

boardRouter.delete("/:id/labels/:labelId", authenticate, requireRole("admin", "owner")(), async (req, res, next) => {
  try {
    const label = await prisma.label.findFirst({ where: { id: req.params.labelId, boardId: req.params.id } });
    if (!label) throw new AppError(404, "Label not found");
    await prisma.taskLabel.deleteMany({ where: { labelId: req.params.labelId } });
    await prisma.label.delete({ where: { id: req.params.labelId } });
    emitBoardEvent(req.params.id, "label:deleted", { id: req.params.labelId });
    res.json({ message: "Label deleted" });
  } catch (err) { next(err); }
});

boardRouter.get("/:id/activity", authenticate, requireRole("admin", "owner", "pm", "member", "viewer")(), async (req, res, next) => {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { boardId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

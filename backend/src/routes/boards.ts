import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import * as boardController from "../controllers/boards";
import * as columnController from "../controllers/columns";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";
import { requireGlobalAdmin } from "../middlewares/adminOnly";
import { emitBoardEvent } from "../sockets";
import { AppError } from "../middlewares/errorHandler";
import { createLog } from "../services/activityLog";
import * as boardService from "../services/boards";
import * as automationService from "../services/automation";


export const boardRouter = Router();

const createBoardSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});

const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isGlobal: z.boolean().optional(),
}).refine(value => value.name !== undefined || value.isGlobal !== undefined, "No changes supplied");

const createColumnSchema = z.object({ name: z.string().trim().min(1).max(100) });
const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid label color"),
});
const triggerTypeEnum = z.enum(["TASK_CREATED", "LABEL_ADDED", "LABEL_REMOVED"]);
const createAutomationSchema = z.object({
  trigger_type: triggerTypeEnum,
  trigger_label_id: z.string().uuid().nullish(),
  trigger_column_id: z.string().uuid().nullish(),
  add_label_ids: z.array(z.string().uuid()).default([]),
  remove_label_ids: z.array(z.string().uuid()).default([]),
  target_column_id: z.string().uuid().nullish(),
}).refine(
  value => (value.trigger_type === "TASK_CREATED" ? !!value.trigger_column_id : !!value.trigger_label_id),
  "Trigger requires a matching label or column",
).refine(
  value => value.add_label_ids.length > 0 || value.remove_label_ids.length > 0 || !!value.target_column_id,
  "A rule must have at least one action",
);
const updateAutomationSchema = z.object({
  trigger_type: triggerTypeEnum.optional(),
  trigger_label_id: z.string().uuid().nullish(),
  trigger_column_id: z.string().uuid().nullish(),
  add_label_ids: z.array(z.string().uuid()).optional(),
  remove_label_ids: z.array(z.string().uuid()).optional(),
  target_column_id: z.string().uuid().nullish(),
  enabled: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, "No changes supplied");

boardRouter.get("/", authenticate, boardController.listBoards);
boardRouter.post("/", authenticate, validate(createBoardSchema), boardController.createBoard);
boardRouter.get("/:id", authenticate, boardController.getBoard);
boardRouter.patch("/:id", authenticate, requireRole("admin", "owner")(), validate(updateBoardSchema), boardController.updateBoard);
boardRouter.delete("/:id", authenticate, requireRole("admin", "owner")(), boardController.deleteBoard);

const transferSchema = z.object({ workspaceId: z.string().uuid() });

boardRouter.get("/:id/transfer-targets", authenticate, requireGlobalAdmin, async (req, res, next) => {
  try {
    res.json(await boardService.getTransferTargets(req.params.id));
  } catch (err) { next(err); }
});

boardRouter.post("/:id/transfer", authenticate, requireGlobalAdmin, validate(transferSchema), async (req, res, next) => {
  try {
    const board = await boardService.transferBoard(req.params.id, req.body.workspaceId);
    if (req.user) await createLog(req.params.id, req.user.userId, "Reassigned board to another workspace");
    res.json(board);
  } catch (err) { next(err); }
});

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

boardRouter.get("/:id/automations", authenticate, requireRole("admin", "owner")(), async (req, res, next) => {
  try { res.json(await automationService.listAutomationRules(req.params.id)); } catch (err) { next(err); }
});

boardRouter.post("/:id/automations", authenticate, requireRole("admin", "owner")(), validate(createAutomationSchema), async (req, res, next) => {
  try {
    const rule = await automationService.createAutomationRule(req.params.id, {
      triggerType: req.body.trigger_type,
      triggerLabelId: req.body.trigger_label_id,
      triggerColumnId: req.body.trigger_column_id,
      addLabelIds: req.body.add_label_ids,
      removeLabelIds: req.body.remove_label_ids,
      targetColumnId: req.body.target_column_id,
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

boardRouter.patch("/:id/automations/:ruleId", authenticate, requireRole("admin", "owner")(), validate(updateAutomationSchema), async (req, res, next) => {
  try {
    const rule = await automationService.updateAutomationRule(req.params.ruleId, req.params.id, {
      triggerType: req.body.trigger_type,
      triggerLabelId: req.body.trigger_label_id,
      triggerColumnId: req.body.trigger_column_id,
      addLabelIds: req.body.add_label_ids,
      removeLabelIds: req.body.remove_label_ids,
      targetColumnId: req.body.target_column_id,
      enabled: req.body.enabled,
    });
    res.json(rule);
  } catch (err) { next(err); }
});

boardRouter.delete("/:id/automations/:ruleId", authenticate, requireRole("admin", "owner")(), async (req, res, next) => {
  try {
    await automationService.deleteAutomationRule(req.params.ruleId, req.params.id);
    res.json({ message: "Automation rule deleted" });
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

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
  description: z.string().trim().max(200).nullish(),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid label color"),
});
const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(200).nullish(),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid label color").optional(),
}).refine(
  value => value.name !== undefined || value.description !== undefined || value.color_hex !== undefined,
  "No changes supplied",
);
const triggerTypeEnum = z.enum([
  "TASK_CREATED", "TASK_MOVED", "LABEL_ADDED", "LABEL_REMOVED",
  "ASSIGNEE_ADDED", "ASSIGNEE_REMOVED", "TASK_COMPLETED",
]);
const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("HAS_LABEL"), labelId: z.string().uuid() }),
  z.object({ type: z.literal("NOT_HAS_LABEL"), labelId: z.string().uuid() }),
  z.object({ type: z.literal("IN_COLUMN"), columnId: z.string().uuid() }),
  z.object({ type: z.literal("HAS_ANY_ASSIGNEE") }),
  z.object({ type: z.literal("HAS_ASSIGNEE"), userId: z.string().uuid() }),
  z.object({ type: z.literal("NO_ASSIGNEE") }),
  z.object({ type: z.literal("TITLE_CONTAINS"), text: z.string().trim().min(1).max(200) }),
]);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_LABELS"), labelIds: z.array(z.string().uuid()).min(1) }),
  z.object({ type: z.literal("REMOVE_LABELS"), labelIds: z.array(z.string().uuid()).min(1) }),
  z.object({ type: z.literal("MOVE_TO_COLUMN"), columnId: z.string().uuid() }),
  z.object({ type: z.literal("ASSIGN_MEMBERS"), userIds: z.array(z.string().uuid()).min(1) }),
  z.object({ type: z.literal("UNASSIGN_MEMBERS"), userIds: z.array(z.string().uuid()).min(1) }),
  z.object({ type: z.literal("SET_DUE_DATE"), offsetDays: z.number().int().min(-3650).max(3650) }),
  z.object({ type: z.literal("CLEAR_DUE_DATE") }),
  z.object({ type: z.literal("ADD_COMMENT"), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("NOTIFY"), target: z.enum(["assignees", "members"]), message: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("MARK_COMPLETE") }),
]);
const triggerRequirements = (value: { trigger_type: z.infer<typeof triggerTypeEnum>; trigger_label_id?: string | null; trigger_column_id?: string | null }) => {
  if (value.trigger_type === "TASK_CREATED" || value.trigger_type === "TASK_MOVED") return !!value.trigger_column_id;
  if (value.trigger_type === "LABEL_ADDED" || value.trigger_type === "LABEL_REMOVED") return !!value.trigger_label_id;
  return true;
};
const createAutomationSchema = z.object({
  trigger_type: triggerTypeEnum,
  trigger_label_id: z.string().uuid().nullish(),
  trigger_column_id: z.string().uuid().nullish(),
  name: z.string().trim().max(100).nullish(),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1, "A rule must have at least one action"),
}).refine(triggerRequirements, "This trigger requires a matching label or column");
const updateAutomationSchema = z.object({
  trigger_type: triggerTypeEnum,
  trigger_label_id: z.string().uuid().nullish(),
  trigger_column_id: z.string().uuid().nullish(),
  name: z.string().trim().max(100).nullish(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1).optional(),
  enabled: z.boolean().optional(),
}).partial({ trigger_type: true }).refine(
  value => value.trigger_type === undefined || triggerRequirements(value as any),
  "This trigger requires a matching label or column",
);

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
    const { name, description, color_hex } = req.body;
    const label = await prisma.label.create({
      data: { boardId: req.params.id, name, description: description || null, colorHex: color_hex },
    });
    emitBoardEvent(req.params.id, "label:created", label);
    res.status(201).json(label);
  } catch (err) { next(err); }
});

boardRouter.patch("/:id/labels/:labelId", authenticate, requireRole("admin", "owner")(), validate(updateLabelSchema), async (req, res, next) => {
  try {
    const existing = await prisma.label.findFirst({ where: { id: req.params.labelId, boardId: req.params.id } });
    if (!existing) throw new AppError(404, "Label not found");
    const { name, description, color_hex } = req.body;
    const label = await prisma.label.update({
      where: { id: req.params.labelId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(color_hex !== undefined ? { colorHex: color_hex } : {}),
      },
    });
    emitBoardEvent(req.params.id, "label:updated", label);
    res.json(label);
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
      name: req.body.name,
      conditions: req.body.conditions,
      actions: req.body.actions,
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
      name: req.body.name,
      conditions: req.body.conditions,
      actions: req.body.actions,
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

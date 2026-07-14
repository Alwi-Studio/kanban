import prisma from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middlewares/errorHandler";
import { updateTask } from "./tasks";
import { addComment } from "./taskDetails";
import { createNotification } from "./notification";

export type TriggerType =
  | "TASK_CREATED"
  | "TASK_MOVED"
  | "LABEL_ADDED"
  | "LABEL_REMOVED"
  | "ASSIGNEE_ADDED"
  | "ASSIGNEE_REMOVED"
  | "TASK_COMPLETED";

export type AutomationCondition =
  | { type: "HAS_LABEL"; labelId: string }
  | { type: "NOT_HAS_LABEL"; labelId: string }
  | { type: "IN_COLUMN"; columnId: string }
  | { type: "HAS_ANY_ASSIGNEE" }
  | { type: "HAS_ASSIGNEE"; userId: string }
  | { type: "NO_ASSIGNEE" }
  | { type: "TITLE_CONTAINS"; text: string };

export type AutomationAction =
  | { type: "ADD_LABELS"; labelIds: string[] }
  | { type: "REMOVE_LABELS"; labelIds: string[] }
  | { type: "MOVE_TO_COLUMN"; columnId: string }
  | { type: "ASSIGN_MEMBERS"; userIds: string[] }
  | { type: "UNASSIGN_MEMBERS"; userIds: string[] }
  | { type: "SET_DUE_DATE"; offsetDays: number }
  | { type: "CLEAR_DUE_DATE" }
  | { type: "ADD_COMMENT"; text: string }
  | { type: "NOTIFY"; target: "assignees" | "members"; message: string }
  | { type: "MARK_COMPLETE" };

export interface AutomationInput {
  triggerType: TriggerType;
  triggerLabelId?: string | null;
  triggerColumnId?: string | null;
  name?: string | null;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
}

const ruleInclude = { triggerLabel: true, triggerColumn: true } as const;

export function listAutomationRules(boardId: string) {
  return prisma.automationRule.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
    include: ruleInclude,
  });
}

// ---- Validation -----------------------------------------------------------

function collectIds(input: Pick<AutomationInput, "triggerLabelId" | "triggerColumnId" | "conditions" | "actions">) {
  const labelIds = new Set<string>();
  const columnIds = new Set<string>();
  const userIds = new Set<string>();
  if (input.triggerLabelId) labelIds.add(input.triggerLabelId);
  if (input.triggerColumnId) columnIds.add(input.triggerColumnId);
  for (const c of input.conditions ?? []) {
    if (c.type === "HAS_LABEL" || c.type === "NOT_HAS_LABEL") labelIds.add(c.labelId);
    else if (c.type === "IN_COLUMN") columnIds.add(c.columnId);
    else if (c.type === "HAS_ASSIGNEE") userIds.add(c.userId);
  }
  for (const a of input.actions ?? []) {
    if (a.type === "ADD_LABELS" || a.type === "REMOVE_LABELS") a.labelIds.forEach(id => labelIds.add(id));
    else if (a.type === "MOVE_TO_COLUMN") columnIds.add(a.columnId);
    else if (a.type === "ASSIGN_MEMBERS" || a.type === "UNASSIGN_MEMBERS") a.userIds.forEach(id => userIds.add(id));
  }
  return { labelIds: [...labelIds], columnIds: [...columnIds], userIds: [...userIds] };
}

async function assertBoardOwnership(boardId: string, input: Partial<AutomationInput>) {
  const { labelIds, columnIds, userIds } = collectIds(input);
  if (labelIds.length) {
    const found = await prisma.label.count({ where: { id: { in: labelIds }, boardId } });
    if (found !== labelIds.length) throw new AppError(400, "A label does not belong to this board");
  }
  if (columnIds.length) {
    const found = await prisma.column.count({ where: { id: { in: columnIds }, boardId } });
    if (found !== columnIds.length) throw new AppError(400, "A column does not belong to this board");
  }
  if (userIds.length) {
    const found = await prisma.boardMember.count({ where: { boardId, userId: { in: userIds } } });
    if (found !== userIds.length) throw new AppError(400, "A user is not a member of this board");
  }
}

function assertShape(input: Pick<AutomationInput, "triggerType" | "triggerLabelId" | "triggerColumnId" | "actions">) {
  const t = input.triggerType;
  if (t === "TASK_CREATED" || t === "TASK_MOVED") {
    if (!input.triggerColumnId) throw new AppError(400, "This trigger requires a column");
  } else if (t === "LABEL_ADDED" || t === "LABEL_REMOVED") {
    if (!input.triggerLabelId) throw new AppError(400, "This trigger requires a label");
  }
  if (!(input.actions?.length)) throw new AppError(400, "A rule must have at least one action");
}

// ---- CRUD -----------------------------------------------------------------

export async function createAutomationRule(boardId: string, input: AutomationInput) {
  assertShape(input);
  await assertBoardOwnership(boardId, input);
  const labelTrigger = input.triggerType === "LABEL_ADDED" || input.triggerType === "LABEL_REMOVED";
  const columnTrigger = input.triggerType === "TASK_CREATED" || input.triggerType === "TASK_MOVED";
  return prisma.automationRule.create({
    data: {
      boardId,
      triggerType: input.triggerType,
      triggerLabelId: labelTrigger ? input.triggerLabelId : null,
      triggerColumnId: columnTrigger ? input.triggerColumnId : null,
      name: input.name ?? null,
      conditions: (input.conditions ?? []) as unknown as Prisma.InputJsonValue,
      actions: (input.actions ?? []) as unknown as Prisma.InputJsonValue,
    },
    include: ruleInclude,
  });
}

export async function updateAutomationRule(
  id: string,
  boardId: string,
  data: Partial<AutomationInput> & { enabled?: boolean },
) {
  const rule = await prisma.automationRule.findFirst({ where: { id, boardId } });
  if (!rule) throw new AppError(404, "Automation rule not found");

  const merged: AutomationInput = {
    triggerType: (data.triggerType ?? rule.triggerType) as TriggerType,
    triggerLabelId: data.triggerLabelId !== undefined ? data.triggerLabelId : rule.triggerLabelId,
    triggerColumnId: data.triggerColumnId !== undefined ? data.triggerColumnId : rule.triggerColumnId,
    name: data.name !== undefined ? data.name : rule.name,
    conditions: data.conditions ?? (rule.conditions as unknown as AutomationCondition[]),
    actions: data.actions ?? (rule.actions as unknown as AutomationAction[]),
  };
  assertShape(merged);
  await assertBoardOwnership(boardId, merged);
  const labelTrigger = merged.triggerType === "LABEL_ADDED" || merged.triggerType === "LABEL_REMOVED";
  const columnTrigger = merged.triggerType === "TASK_CREATED" || merged.triggerType === "TASK_MOVED";

  return prisma.automationRule.update({
    where: { id },
    data: {
      triggerType: merged.triggerType,
      triggerLabelId: labelTrigger ? merged.triggerLabelId : null,
      triggerColumnId: columnTrigger ? merged.triggerColumnId : null,
      name: merged.name ?? null,
      conditions: (merged.conditions ?? []) as unknown as Prisma.InputJsonValue,
      actions: (merged.actions ?? []) as unknown as Prisma.InputJsonValue,
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
    },
    include: ruleInclude,
  });
}

export async function deleteAutomationRule(id: string, boardId: string) {
  const result = await prisma.automationRule.deleteMany({ where: { id, boardId } });
  if (!result.count) throw new AppError(404, "Automation rule not found");
}

// ---- Runner ---------------------------------------------------------------

export interface AutomationTrigger {
  type: TriggerType;
  labelId?: string;
  columnId?: string;
}

export interface AutomationResult {
  summary: string[];
}

interface TaskState {
  boardId: string;
  columnId: string;
  title: string;
  completedAt: Date | null;
  labelIds: Set<string>;
  assigneeIds: Set<string>;
}

async function loadTaskState(taskId: string): Promise<TaskState | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      columnId: true,
      title: true,
      completedAt: true,
      column: { select: { boardId: true } },
      taskLabels: { select: { labelId: true } },
      assignees: { select: { userId: true } },
    },
  });
  if (!task) return null;
  return {
    boardId: task.column.boardId,
    columnId: task.columnId,
    title: task.title,
    completedAt: task.completedAt,
    labelIds: new Set(task.taskLabels.map(tl => tl.labelId)),
    assigneeIds: new Set(task.assignees.map(a => a.userId)),
  };
}

function conditionsPass(conditions: AutomationCondition[], state: TaskState): boolean {
  return conditions.every(condition => {
    switch (condition.type) {
      case "HAS_LABEL": return state.labelIds.has(condition.labelId);
      case "NOT_HAS_LABEL": return !state.labelIds.has(condition.labelId);
      case "IN_COLUMN": return state.columnId === condition.columnId;
      case "HAS_ANY_ASSIGNEE": return state.assigneeIds.size > 0;
      case "HAS_ASSIGNEE": return state.assigneeIds.has(condition.userId);
      case "NO_ASSIGNEE": return state.assigneeIds.size === 0;
      case "TITLE_CONTAINS": return state.title.toLowerCase().includes(condition.text.toLowerCase());
      default: return false;
    }
  });
}

// Runs every enabled rule whose trigger matches, in a single pass. Actions call
// the service layer directly (never the controllers), so automation-driven
// changes never re-trigger rules — no chaining, no loops.
export async function applyAutomation(
  taskId: string,
  trigger: AutomationTrigger,
  actorId?: string,
): Promise<AutomationResult | null> {
  const first = await loadTaskState(taskId);
  if (!first) return null;
  const boardId = first.boardId;

  const where: Prisma.AutomationRuleWhereInput = { boardId, enabled: true, triggerType: trigger.type };
  if (trigger.type === "TASK_CREATED" || trigger.type === "TASK_MOVED") {
    if (!trigger.columnId) return null;
    where.triggerColumnId = trigger.columnId;
  } else if (trigger.type === "LABEL_ADDED" || trigger.type === "LABEL_REMOVED") {
    if (!trigger.labelId) return null;
    where.triggerLabelId = trigger.labelId;
  }

  const rules = await prisma.automationRule.findMany({ where, orderBy: { createdAt: "asc" } });
  if (!rules.length) return null;

  const summary: string[] = [];
  for (const rule of rules) {
    const state = await loadTaskState(taskId);
    if (!state) break;
    const conditions = (rule.conditions as unknown as AutomationCondition[]) ?? [];
    if (!conditionsPass(conditions, state)) continue;
    const actions = (rule.actions as unknown as AutomationAction[]) ?? [];
    for (const action of actions) {
      const done = await runAction(taskId, boardId, state, action, actorId);
      if (done) summary.push(done);
    }
  }

  return summary.length ? { summary } : null;
}

async function runAction(
  taskId: string,
  boardId: string,
  state: TaskState,
  action: AutomationAction,
  actorId?: string,
): Promise<string | null> {
  switch (action.type) {
    case "ADD_LABELS": {
      const valid = await prisma.label.findMany({
        where: { id: { in: action.labelIds }, boardId },
        select: { id: true },
      });
      if (!valid.length) return null;
      await prisma.taskLabel.createMany({
        data: valid.map(l => ({ taskId, labelId: l.id })),
        skipDuplicates: true,
      });
      return `added ${valid.length} label(s)`;
    }
    case "REMOVE_LABELS": {
      const res = await prisma.taskLabel.deleteMany({ where: { taskId, labelId: { in: action.labelIds } } });
      return res.count ? `removed ${res.count} label(s)` : null;
    }
    case "MOVE_TO_COLUMN": {
      const column = await prisma.column.findFirst({ where: { id: action.columnId, boardId }, select: { id: true, name: true } });
      if (!column || column.id === state.columnId) return null;
      const position = await prisma.task.count({ where: { columnId: column.id } });
      await updateTask(taskId, { columnId: column.id, position });
      return `moved task to "${column.name}"`;
    }
    case "ASSIGN_MEMBERS": {
      const members = await prisma.boardMember.findMany({
        where: { boardId, userId: { in: action.userIds } },
        select: { userId: true },
      });
      const toAdd = members.map(m => m.userId).filter(uid => !state.assigneeIds.has(uid));
      if (!toAdd.length) return null;
      await prisma.taskAssignee.createMany({
        data: toAdd.map(userId => ({ taskId, userId })),
        skipDuplicates: true,
      });
      return `assigned ${toAdd.length} member(s)`;
    }
    case "UNASSIGN_MEMBERS": {
      const res = await prisma.taskAssignee.deleteMany({ where: { taskId, userId: { in: action.userIds } } });
      return res.count ? `unassigned ${res.count} member(s)` : null;
    }
    case "SET_DUE_DATE": {
      const dueDate = new Date(Date.now() + action.offsetDays * 24 * 60 * 60 * 1000);
      await updateTask(taskId, { dueDate });
      return `set due date`;
    }
    case "CLEAR_DUE_DATE": {
      await updateTask(taskId, { dueDate: null });
      return `cleared due date`;
    }
    case "ADD_COMMENT": {
      if (!actorId || !action.text.trim()) return null;
      await addComment(taskId, actorId, action.text);
      return `added a comment`;
    }
    case "NOTIFY": {
      const recipientIds = action.target === "assignees"
        ? [...state.assigneeIds]
        : (await prisma.boardMember.findMany({ where: { boardId }, select: { userId: true } })).map(m => m.userId);
      if (!recipientIds.length) return null;
      await Promise.all(recipientIds.map(userId => createNotification(userId, boardId, taskId, action.message)));
      return `notified ${recipientIds.length} user(s)`;
    }
    case "MARK_COMPLETE": {
      if (state.completedAt) return null;
      await prisma.task.update({ where: { id: taskId }, data: { completedAt: new Date() } });
      return `marked task complete`;
    }
    default:
      return null;
  }
}

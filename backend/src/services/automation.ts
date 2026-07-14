import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";
import { updateTask } from "./tasks";

export type TriggerType = "TASK_CREATED" | "LABEL_ADDED" | "LABEL_REMOVED";

export interface AutomationInput {
  triggerType: TriggerType;
  triggerLabelId?: string | null;
  triggerColumnId?: string | null;
  addLabelIds?: string[];
  removeLabelIds?: string[];
  targetColumnId?: string | null;
}

const ruleInclude = {
  triggerLabel: true,
  triggerColumn: true,
  targetColumn: true,
} as const;

export function listAutomationRules(boardId: string) {
  return prisma.automationRule.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
    include: ruleInclude,
  });
}

// Verify every label/column referenced by a rule actually belongs to the board.
async function assertBoardOwnership(boardId: string, input: Partial<AutomationInput>) {
  const labelIds = [
    input.triggerLabelId,
    ...(input.addLabelIds ?? []),
    ...(input.removeLabelIds ?? []),
  ].filter((id): id is string => !!id);
  const columnIds = [input.triggerColumnId, input.targetColumnId].filter(
    (id): id is string => !!id,
  );

  if (labelIds.length) {
    const found = await prisma.label.findMany({
      where: { id: { in: labelIds }, boardId },
      select: { id: true },
    });
    if (found.length !== new Set(labelIds).size) {
      throw new AppError(400, "A label does not belong to this board");
    }
  }
  if (columnIds.length) {
    const found = await prisma.column.findMany({
      where: { id: { in: columnIds }, boardId },
      select: { id: true },
    });
    if (found.length !== new Set(columnIds).size) {
      throw new AppError(400, "A column does not belong to this board");
    }
  }
}

function assertTriggerShape(input: Pick<AutomationInput, "triggerType" | "triggerLabelId" | "triggerColumnId" | "addLabelIds" | "removeLabelIds" | "targetColumnId">) {
  if (input.triggerType === "TASK_CREATED") {
    if (!input.triggerColumnId) throw new AppError(400, "A trigger column is required for this trigger");
  } else if (!input.triggerLabelId) {
    throw new AppError(400, "A trigger label is required for this trigger");
  }
  const hasAction =
    (input.addLabelIds?.length ?? 0) > 0 ||
    (input.removeLabelIds?.length ?? 0) > 0 ||
    !!input.targetColumnId;
  if (!hasAction) throw new AppError(400, "A rule must have at least one action");
}

export async function createAutomationRule(boardId: string, input: AutomationInput) {
  assertTriggerShape(input);
  await assertBoardOwnership(boardId, input);
  return prisma.automationRule.create({
    data: {
      boardId,
      triggerType: input.triggerType,
      triggerLabelId: input.triggerType === "TASK_CREATED" ? null : input.triggerLabelId,
      triggerColumnId: input.triggerType === "TASK_CREATED" ? input.triggerColumnId : null,
      addLabelIds: input.addLabelIds ?? [],
      removeLabelIds: input.removeLabelIds ?? [],
      targetColumnId: input.targetColumnId ?? null,
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

  const merged = {
    triggerType: (data.triggerType ?? rule.triggerType) as TriggerType,
    triggerLabelId: data.triggerLabelId !== undefined ? data.triggerLabelId : rule.triggerLabelId,
    triggerColumnId: data.triggerColumnId !== undefined ? data.triggerColumnId : rule.triggerColumnId,
    addLabelIds: data.addLabelIds ?? rule.addLabelIds,
    removeLabelIds: data.removeLabelIds ?? rule.removeLabelIds,
    targetColumnId: data.targetColumnId !== undefined ? data.targetColumnId : rule.targetColumnId,
  };
  assertTriggerShape(merged);
  await assertBoardOwnership(boardId, merged);

  return prisma.automationRule.update({
    where: { id },
    data: {
      triggerType: merged.triggerType,
      triggerLabelId: merged.triggerType === "TASK_CREATED" ? null : merged.triggerLabelId,
      triggerColumnId: merged.triggerType === "TASK_CREATED" ? merged.triggerColumnId : null,
      addLabelIds: merged.addLabelIds,
      removeLabelIds: merged.removeLabelIds,
      targetColumnId: merged.targetColumnId,
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
    },
    include: ruleInclude,
  });
}

export async function deleteAutomationRule(id: string, boardId: string) {
  const result = await prisma.automationRule.deleteMany({ where: { id, boardId } });
  if (!result.count) throw new AppError(404, "Automation rule not found");
}

export interface AutomationTrigger {
  type: TriggerType;
  labelId?: string;
  columnId?: string;
}

export interface AutomationResult {
  addedLabelIds: string[];
  removedLabelIds: string[];
  movedToColumn: { id: string; name: string } | null;
}

// Runs every enabled rule whose trigger matches, applying its actions in a
// single pass. Automation-driven label/column changes never re-trigger rules
// (no chaining), so infinite loops are impossible by construction.
export async function applyAutomation(
  taskId: string,
  trigger: AutomationTrigger,
): Promise<AutomationResult | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, columnId: true, column: { select: { boardId: true } } },
  });
  if (!task) return null;
  const boardId = task.column.boardId;

  const where: {
    boardId: string;
    enabled: boolean;
    triggerType: TriggerType;
    triggerColumnId?: string;
    triggerLabelId?: string;
  } = { boardId, enabled: true, triggerType: trigger.type };
  if (trigger.type === "TASK_CREATED") {
    if (!trigger.columnId) return null;
    where.triggerColumnId = trigger.columnId;
  } else {
    if (!trigger.labelId) return null;
    where.triggerLabelId = trigger.labelId;
  }

  const rules = await prisma.automationRule.findMany({ where, include: ruleInclude });
  if (!rules.length) return null;

  const addedLabelIds = new Set<string>();
  const removedLabelIds = new Set<string>();
  let currentColumnId = task.columnId;
  let movedToColumn: { id: string; name: string } | null = null;

  for (const rule of rules) {
    if (rule.addLabelIds.length) {
      // Only add labels that still belong to this board.
      const valid = await prisma.label.findMany({
        where: { id: { in: rule.addLabelIds }, boardId },
        select: { id: true },
      });
      if (valid.length) {
        await prisma.taskLabel.createMany({
          data: valid.map(label => ({ taskId, labelId: label.id })),
          skipDuplicates: true,
        });
        valid.forEach(label => addedLabelIds.add(label.id));
      }
    }

    if (rule.removeLabelIds.length) {
      await prisma.taskLabel.deleteMany({
        where: { taskId, labelId: { in: rule.removeLabelIds } },
      });
      rule.removeLabelIds.forEach(id => removedLabelIds.add(id));
    }

    if (rule.targetColumn && rule.targetColumn.id !== currentColumnId) {
      const position = await prisma.task.count({ where: { columnId: rule.targetColumn.id } });
      await updateTask(taskId, { columnId: rule.targetColumn.id, position });
      currentColumnId = rule.targetColumn.id;
      movedToColumn = { id: rule.targetColumn.id, name: rule.targetColumn.name };
    }
  }

  if (!addedLabelIds.size && !removedLabelIds.size && !movedToColumn) return null;
  return {
    addedLabelIds: [...addedLabelIds],
    removedLabelIds: [...removedLabelIds],
    movedToColumn,
  };
}

import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";
import { updateTask } from "./tasks";

export function listAutomationRules(boardId: string) {
  return prisma.automationRule.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
    include: { label: true, targetColumn: true },
  });
}

export async function createAutomationRule(boardId: string, labelId: string, targetColumnId: string) {
  const [label, targetColumn] = await Promise.all([
    prisma.label.findFirst({ where: { id: labelId, boardId } }),
    prisma.column.findFirst({ where: { id: targetColumnId, boardId } }),
  ]);
  if (!label) throw new AppError(400, "Label does not belong to this board");
  if (!targetColumn) throw new AppError(400, "Target column does not belong to this board");
  return prisma.automationRule.create({
    data: { boardId, labelId, targetColumnId },
    include: { label: true, targetColumn: true },
  });
}

export async function updateAutomationRule(id: string, boardId: string, data: { targetColumnId?: string; enabled?: boolean }) {
  const rule = await prisma.automationRule.findFirst({ where: { id, boardId } });
  if (!rule) throw new AppError(404, "Automation rule not found");
  if (data.targetColumnId) {
    const column = await prisma.column.findFirst({ where: { id: data.targetColumnId, boardId } });
    if (!column) throw new AppError(400, "Target column does not belong to this board");
  }
  return prisma.automationRule.update({
    where: { id },
    data,
    include: { label: true, targetColumn: true },
  });
}

export async function deleteAutomationRule(id: string, boardId: string) {
  const result = await prisma.automationRule.deleteMany({ where: { id, boardId } });
  if (!result.count) throw new AppError(404, "Automation rule not found");
}

export async function runLabelAutomation(taskId: string, labelId: string) {
  const rule = await prisma.automationRule.findFirst({
    where: { labelId, enabled: true },
    include: { label: true, targetColumn: true },
  });
  if (!rule) return null;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { columnId: true, column: { select: { boardId: true } } },
  });
  if (!task || task.column.boardId !== rule.boardId || task.columnId === rule.targetColumnId) return null;
  const position = await prisma.task.count({ where: { columnId: rule.targetColumnId } });
  const movedTask = await updateTask(taskId, { columnId: rule.targetColumnId, position });
  return { task: movedTask, rule };
}

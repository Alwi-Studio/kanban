import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";


export async function addAssignee(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  if (!task) throw new AppError(404, "Task not found");
  const membership = await prisma.boardMember.findFirst({
    where: { boardId: task.column.boardId, userId },
    select: { id: true },
  });
  if (!membership) throw new AppError(400, "Assignee must be a board member");
  const existing = await prisma.taskAssignee.findFirst({ where: { taskId, userId } });
  if (existing) throw new AppError(409, "User is already assigned");
  return prisma.taskAssignee.create({
    data: { taskId, userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function removeAssignee(taskId: string, userId: string) {
  const assignee = await prisma.taskAssignee.findFirst({
    where: { taskId, userId },
  });
  if (assignee) {
    await prisma.taskAssignee.delete({ where: { id: assignee.id } });
  }
}

export async function addComment(taskId: string, userId: string, content: string) {
  return prisma.comment.create({
    data: { taskId, userId, content },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function getComments(taskId: string) {
  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function addAttachment(
  taskId: string,
  fileUrl: string,
  fileName: string,
  fileSize: number,
) {
  return prisma.attachment.create({
    data: { taskId, fileUrl, fileName, fileSize },
  });
}

export async function getAttachments(taskId: string) {
  return prisma.attachment.findMany({
    where: { taskId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function addLabelToTask(taskId: string, labelId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  if (!task) throw new AppError(404, "Task not found");
  const label = await prisma.label.findFirst({ where: { id: labelId, boardId: task.column.boardId } });
  if (!label) throw new AppError(400, "Label does not belong to this board");
  return prisma.taskLabel.create({
    data: { taskId, labelId },
    include: { label: true },
  });
}

export async function removeLabelFromTask(taskId: string, labelId: string) {
  await prisma.taskLabel.delete({
    where: { taskId_labelId: { taskId, labelId } },
  });
}

export async function getTaskBoards(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  return task?.column.boardId;
}

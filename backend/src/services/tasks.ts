import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";


export async function createTask(columnId: string, title: string, description?: string) {
  const maxPos = await prisma.task.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;
  return prisma.task.create({
    data: { columnId, title, description, position },
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      taskLabels: { include: { label: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    position?: number;
    columnId?: string;
    dueDate?: Date | null;
    version?: number;
  },
) {
  if (data.columnId !== undefined || data.position !== undefined) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "not found");
    if (data.version !== undefined && existing.version !== data.version) {
      throw new AppError(409, "conflict - refresh and try again");
    }
    return prisma.task.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        taskLabels: { include: { label: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    });
  }

  return prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
    },
    include: {
      assignees: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      taskLabels: { include: { label: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });
}

export async function deleteTask(id: string) {
  await prisma.taskLabel.deleteMany({ where: { taskId: id } });
  await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
  await prisma.comment.deleteMany({ where: { taskId: id } });
  await prisma.attachment.deleteMany({ where: { taskId: id } });
  await prisma.task.delete({ where: { id } });
}

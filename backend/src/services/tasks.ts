import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";

function isDoneColumn(name: string) {
  return ["done", "completed", "complete", "selesai"].includes(name.trim().toLowerCase());
}

export async function createTask(columnId: string, title: string, description?: string) {
  const [maxPos, column] = await Promise.all([
    prisma.task.aggregate({ where: { columnId }, _max: { position: true } }),
    prisma.column.findUnique({ where: { id: columnId }, select: { name: true } }),
  ]);
  if (!column) throw new AppError(404, "Column not found");
  const position = (maxPos._max.position ?? -1) + 1;
  return prisma.task.create({
    data: { columnId, title, description, position, completedAt: isDoneColumn(column.name) ? new Date() : null },
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
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, columnId: true, position: true, version: true, completedAt: true, column: { select: { boardId: true } } },
    });
    if (!existing) throw new AppError(404, "not found");
    if (data.version !== undefined && existing.version !== data.version) {
      throw new AppError(409, "conflict - refresh and try again");
    }
    const targetColumnId = data.columnId || existing.columnId;
    const targetColumn = await prisma.column.findUnique({ where: { id: targetColumnId }, select: { boardId: true, name: true } });
    if (!targetColumn) throw new AppError(404, "Target column not found");
    if (targetColumn.boardId !== existing.column.boardId) {
      throw new AppError(400, "Tasks cannot be moved to another board");
    }

    await prisma.$transaction(async tx => {
      const targetTasks = await tx.task.findMany({
        where: { columnId: targetColumnId, id: { not: id } },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const requestedPosition = data.position ?? existing.position;
      const targetIndex = Math.max(0, Math.min(Math.trunc(requestedPosition), targetTasks.length));
      targetTasks.splice(targetIndex, 0, { id });

      if (existing.columnId !== targetColumnId) {
        const sourceTasks = await tx.task.findMany({
          where: { columnId: existing.columnId, id: { not: id } },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        for (let position = 0; position < sourceTasks.length; position++) {
          await tx.task.update({ where: { id: sourceTasks[position].id }, data: { position } });
        }
      }

      for (let position = 0; position < targetTasks.length; position++) {
        const task = targetTasks[position];
        await tx.task.update({
          where: { id: task.id },
          data: task.id === id
            ? {
                columnId: targetColumnId,
                position,
                version: { increment: 1 },
                ...(existing.columnId !== targetColumnId
                  ? { completedAt: isDoneColumn(targetColumn.name) ? (existing.completedAt || new Date()) : null }
                  : {}),
              }
            : { position },
        });
      }
    });

    return prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
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

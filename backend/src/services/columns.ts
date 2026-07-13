import prisma from "../lib/prisma";

const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  taskLabels: { include: { label: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

export async function createColumn(boardId: string, name: string) {
  const maxPos = await prisma.column.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;
  return prisma.column.create({
    data: { boardId, name, position },
    include: { tasks: { orderBy: { position: "asc" }, include: taskInclude } },
  });
}

export async function updateColumn(id: string, data: { name?: string; position?: number }) {
  if (data.position !== undefined) {
    const column = await prisma.column.findUnique({ where: { id } });
    if (!column) return null;
    await prisma.$transaction(async tx => {
      const siblings = await tx.column.findMany({
        where: { boardId: column.boardId, id: { not: id } },
        orderBy: { position: "asc" },
      });
      const index = Math.max(0, Math.min(Math.trunc(data.position!), siblings.length));
      siblings.splice(index, 0, column);
      for (let position = 0; position < siblings.length; position++) {
        await tx.column.update({ where: { id: siblings[position].id }, data: { position } });
      }
    });
  }

  return prisma.column.update({
    where: { id },
    data: { name: data.name },
    include: { tasks: { orderBy: { position: "asc" }, include: taskInclude } },
  });
}

export async function deleteColumn(id: string) {
  const column = await prisma.column.findUnique({ where: { id } });
  if (!column) return;

  await prisma.taskLabel.deleteMany({
    where: { task: { columnId: id } },
  });
  await prisma.taskAssignee.deleteMany({
    where: { task: { columnId: id } },
  });
  await prisma.comment.deleteMany({
    where: { task: { columnId: id } },
  });
  await prisma.attachment.deleteMany({
    where: { task: { columnId: id } },
  });
  await prisma.task.deleteMany({ where: { columnId: id } });
  await prisma.column.delete({ where: { id } });
}

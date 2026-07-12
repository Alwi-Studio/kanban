import prisma from "../lib/prisma";


export async function createColumn(boardId: string, name: string) {
  const maxPos = await prisma.column.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;
  return prisma.column.create({
    data: { boardId, name, position },
  });
}

export async function updateColumn(id: string, data: { name?: string; position?: number }) {
  return prisma.column.update({
    where: { id },
    data,
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

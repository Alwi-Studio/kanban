import prisma from "../lib/prisma";


export async function listBoards(workspaceId: string) {
  return prisma.board.findMany({
    where: { workspaceId },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              assignees: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              taskLabels: {
                include: { label: true },
              },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });
}

export async function getBoard(id: string) {
  return prisma.board.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              assignees: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              taskLabels: {
                include: { label: true },
              },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      labels: true,
    },
  });
}

export async function createBoard(workspaceId: string, name: string, userId: string) {
  return prisma.board.create({
    data: {
      workspaceId,
      name,
      members: {
        create: { userId, role: "admin" },
      },
      columns: {
        create: [
          { name: "To Do", position: 0 },
          { name: "In Progress", position: 1 },
          { name: "Done", position: 2 },
        ],
      },
    },
    include: {
      columns: { orderBy: { position: "asc" } },
    },
  });
}

export async function updateBoard(id: string, name: string) {
  return prisma.board.update({
    where: { id },
    data: { name },
  });
}

export async function deleteBoard(id: string) {
  const del = (table: string, filter: any) =>
    (prisma as any)[table].deleteMany({ where: filter });
  await del("taskLabel", { task: { column: { boardId: id } } });
  await del("taskAssignee", { task: { column: { boardId: id } } });
  await del("comment", { task: { column: { boardId: id } } });
  await del("attachment", { task: { column: { boardId: id } } });
  await del("task", { column: { boardId: id } });
  await del("label", { boardId: id });
  await del("activityLog", { boardId: id });
  await del("boardMember", { boardId: id });
  await del("column", { boardId: id });
  await prisma.board.delete({ where: { id } });
}

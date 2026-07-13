import prisma from "../lib/prisma";


export async function listBoards(workspaceId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } });
  return prisma.board.findMany({
    where: { workspaceId, ...(user?.isGlobalAdmin ? {} : { members: { some: { userId } } }) },
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

export async function getBoard(id: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } });
  return prisma.board.findFirst({
    // Global admins see any board; everyone else sees boards they belong to or
    // any board marked global (org-wide, read-only for non-members).
    where: user?.isGlobalAdmin ? { id } : { id, OR: [{ isGlobal: true }, { members: { some: { userId } } }] },
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

export async function updateBoard(id: string, data: { name?: string; isGlobal?: boolean }) {
  return prisma.board.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.isGlobal !== undefined ? { isGlobal: data.isGlobal } : {}),
    },
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
  await del("notification", { boardId: id });
  await del("boardMember", { boardId: id });
  await del("column", { boardId: id });
  await prisma.board.delete({ where: { id } });
}

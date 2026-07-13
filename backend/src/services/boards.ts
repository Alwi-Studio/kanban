import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";


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

// Workspaces a board can be reassigned to (every workspace except its current one).
export async function getTransferTargets(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { workspaceId: true } });
  if (!board) throw new AppError(404, "Board not found");
  const workspaces = await prisma.workspace.findMany({
    where: { id: { not: board.workspaceId } },
    select: { id: true, name: true, owner: { select: { name: true, email: true } } },
    orderBy: { name: "asc" },
  });
  return workspaces.map(w => ({ workspaceId: w.id, name: w.name, ownerName: w.owner.name, ownerEmail: w.owner.email }));
}

// Move a board to another workspace and guarantee the new workspace owner can manage it.
export async function transferBoard(boardId: string, targetWorkspaceId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true, workspaceId: true } });
  if (!board) throw new AppError(404, "Board not found");
  if (board.workspaceId === targetWorkspaceId) throw new AppError(400, "Board is already in that workspace");

  const workspace = await prisma.workspace.findUnique({ where: { id: targetWorkspaceId }, select: { id: true, ownerId: true } });
  if (!workspace) throw new AppError(404, "Target workspace not found");

  await prisma.board.update({ where: { id: boardId }, data: { workspaceId: targetWorkspaceId } });

  const existing = await prisma.boardMember.findFirst({ where: { boardId, userId: workspace.ownerId } });
  if (existing) {
    if (existing.role !== "admin") await prisma.boardMember.update({ where: { id: existing.id }, data: { role: "admin" } });
  } else {
    await prisma.boardMember.create({ data: { boardId, userId: workspace.ownerId, role: "admin" } });
  }

  return prisma.board.findUnique({ where: { id: boardId } });
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

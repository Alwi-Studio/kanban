import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  isGlobalAdmin: boolean;
  boardCount: number;
  adminBoardCount: number;
  memberships: { boardId: string; boardName: string; role: string }[];
}

// Every user in the system with a snapshot of their access, for the admin panel.
export async function listUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ isGlobalAdmin: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      isGlobalAdmin: true,
      boardMembers: {
        select: { boardId: true, role: true, board: { select: { name: true } } },
      },
    },
  });

  return users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    isGlobalAdmin: user.isGlobalAdmin,
    boardCount: user.boardMembers.length,
    adminBoardCount: user.boardMembers.filter(m => m.role === "admin").length,
    memberships: user.boardMembers.map(m => ({
      boardId: m.boardId,
      boardName: m.board.name,
      role: m.role,
    })),
  }));
}

// Grant or revoke global admin. Refuses to remove the last global admin so the
// org can never lock itself out of the admin panel.
export async function setGlobalAdmin(userId: string, value: boolean): Promise<AdminUserRow> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isGlobalAdmin: true } });
  if (!target) throw new AppError(404, "User not found");

  if (target.isGlobalAdmin && !value) {
    const adminCount = await prisma.user.count({ where: { isGlobalAdmin: true } });
    if (adminCount <= 1) throw new AppError(409, "There must be at least one global admin");
  }

  await prisma.user.update({ where: { id: userId }, data: { isGlobalAdmin: value } });
  const rows = await listUsers();
  const row = rows.find(r => r.id === userId);
  if (!row) throw new AppError(404, "User not found");
  return row;
}

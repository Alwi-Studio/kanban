import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";
import bcrypt from "bcryptjs";

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

export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) throw new AppError(404, "User not found");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}

export async function deleteUser(userId: string, actingUserId: string): Promise<void> {
  if (userId === actingUserId) {
    throw new AppError(409, "You cannot delete your own account from the admin panel");
  }

  await prisma.$transaction(async tx => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isGlobalAdmin: true },
    });
    if (!target) throw new AppError(404, "User not found");

    if (target.isGlobalAdmin) {
      const adminCount = await tx.user.count({ where: { isGlobalAdmin: true } });
      if (adminCount <= 1) throw new AppError(409, "The last global admin cannot be deleted");
    }

    // Owned workspaces are account data. The original schema has restrictive
    // foreign keys, so remove their dependent records in a single transaction.
    const workspaces = await tx.workspace.findMany({ where: { ownerId: userId }, select: { id: true } });
    const workspaceIds = workspaces.map(workspace => workspace.id);
    const boards = await tx.board.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } });
    const boardIds = boards.map(board => board.id);
    const ownedTaskFilter = { column: { boardId: { in: boardIds } } };

    await tx.taskLabel.deleteMany({ where: { task: ownedTaskFilter } });
    await tx.taskAssignee.deleteMany({ where: { OR: [{ userId }, { task: ownedTaskFilter }] } });
    await tx.comment.deleteMany({ where: { OR: [{ userId }, { task: ownedTaskFilter }] } });
    await tx.attachment.deleteMany({ where: { task: ownedTaskFilter } });
    await tx.task.deleteMany({ where: ownedTaskFilter });
    await tx.automationRule.deleteMany({ where: { boardId: { in: boardIds } } });
    await tx.label.deleteMany({ where: { boardId: { in: boardIds } } });
    await tx.activityLog.deleteMany({ where: { OR: [{ userId }, { boardId: { in: boardIds } }] } });
    await tx.notification.deleteMany({ where: { OR: [{ userId }, { boardId: { in: boardIds } }] } });
    await tx.boardMember.deleteMany({ where: { OR: [{ userId }, { boardId: { in: boardIds } }] } });
    await tx.column.deleteMany({ where: { boardId: { in: boardIds } } });
    await tx.board.deleteMany({ where: { id: { in: boardIds } } });
    await tx.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

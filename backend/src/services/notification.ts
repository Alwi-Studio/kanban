import prisma from "../lib/prisma";
import { emitBoardEvent } from "../sockets";


export async function createNotification(
  userId: string,
  boardId: string,
  taskId: string | null,
  message: string,
) {
  const notif = await prisma.notification.create({
    data: { userId, boardId, taskId, message },
  });
  // Emit to the user's personal room (or board room for simplicity)
  emitBoardEvent(boardId, "notification:new", notif);
  return notif;
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

export async function markAsRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

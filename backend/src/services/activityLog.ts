import prisma from "../lib/prisma";


export async function createLog(boardId: string, userId: string, action: string) {
  return prisma.activityLog.create({
    data: { boardId, userId, action },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function getLogs(boardId: string, limit = 50) {
  return prisma.activityLog.findMany({
    where: { boardId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });
}

import prisma from "../lib/prisma";
import { AppError } from "../middlewares/errorHandler";


export async function addMember(boardId: string, userId: string, role = "member") {
  const existing = await prisma.boardMember.findFirst({
    where: { boardId, userId },
  });
  if (existing) throw new AppError(409, "User is already a member");
  return prisma.boardMember.create({
    data: { boardId, userId, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateMemberRole(boardId: string, userId: string, role: string) {
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId },
  });
  if (!member) throw new AppError(404, "Member not found");
  return prisma.boardMember.update({
    where: { id: member.id },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function removeMember(boardId: string, userId: string) {
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId },
  });
  if (!member) throw new AppError(404, "Member not found");
  await prisma.boardMember.delete({ where: { id: member.id } });
}

export async function getUserRole(boardId: string, userId: string): Promise<string | null> {
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId },
  });
  return member?.role || null;
}

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
  if (member.role === "admin" && role !== "admin") {
    const adminCount = await prisma.boardMember.count({ where: { boardId, role: "admin" } });
    if (adminCount <= 1) throw new AppError(409, "A board must have at least one admin");
  }
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
  if (member.role === "admin") {
    const adminCount = await prisma.boardMember.count({ where: { boardId, role: "admin" } });
    if (adminCount <= 1) throw new AppError(409, "A board must have at least one admin");
  }
  await prisma.boardMember.delete({ where: { id: member.id } });
}

export async function getUserRole(boardId: string, userId: string): Promise<string | null> {
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId },
  });
  return member?.role || null;
}

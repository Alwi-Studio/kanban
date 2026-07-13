import { Router } from "express";
import prisma from "../lib/prisma";
import { z } from "zod";
import { authenticate } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { requireRole } from "../middlewares/role";
import { addMember, updateMemberRole, removeMember } from "../services/member";
import { createLog } from "../services/activityLog";
import { emitBoardEvent } from "../sockets";

export const memberRouter = Router();

const memberRoleSchema = z.enum(["admin", "pm", "member", "viewer"]);

const addMemberSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  role: memberRoleSchema.default("member"),
});

const updateMemberSchema = z.object({ role: memberRoleSchema });

memberRouter.post("/boards/:id/members", authenticate, requireRole("admin", "owner")(), validate(addMemberSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: req.body.email, mode: "insensitive" } } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const member = await addMember(req.params.id, user.id, req.body.role);
    if (req.user) await createLog(req.params.id, req.user.userId, `Added member ${user.name}`);
    emitBoardEvent(req.params.id, "member:added", member);
    res.status(201).json(member);
  } catch (err) { next(err); }
});

memberRouter.patch("/boards/:id/members/:userId", authenticate, requireRole("admin", "owner")(), validate(updateMemberSchema), async (req, res, next) => {
  try {
    const { role } = req.body;
    const member = await updateMemberRole(req.params.id, req.params.userId, role);
    if (req.user) await createLog(req.params.id, req.user.userId, `Changed member role to ${role}`);
    emitBoardEvent(req.params.id, "member:updated", member);
    res.json(member);
  } catch (err) { next(err); }
});

memberRouter.delete("/boards/:id/members/:userId", authenticate, requireRole("admin", "owner")(), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    await removeMember(req.params.id, req.params.userId);
    if (req.user && user) await createLog(req.params.id, req.user.userId, `Removed member ${user.name}`);
    emitBoardEvent(req.params.id, "member:removed", { boardId: req.params.id, userId: req.params.userId });
    res.json({ message: "Member removed" });
  } catch (err) { next(err); }
});

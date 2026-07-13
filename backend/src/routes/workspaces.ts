import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { z } from "zod";
import { validate } from "../middlewares/validate";

export const workspaceRouter = Router();

workspaceRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isGlobalAdmin: true } });
    const workspaces = await prisma.workspace.findMany({
      where: user?.isGlobalAdmin ? {} : {
        OR: [
          { ownerId: req.user!.userId },
          { boards: { some: { members: { some: { userId: req.user!.userId } } } } },
        ],
      },
      include: {
        boards: {
          where: user?.isGlobalAdmin ? {} : { members: { some: { userId: req.user!.userId } } },
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
        },
      },
    });
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post("/", authenticate, validate(z.object({ name: z.string().trim().min(1).max(100) })), async (req, res, next) => {
  try {
    const { name } = req.body;
    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: req.user!.userId,
      },
    });
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

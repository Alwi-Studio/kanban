import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middlewares/auth";

export const workspaceRouter = Router();

workspaceRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: req.user!.userId },
      include: {
        boards: {
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

workspaceRouter.post("/", authenticate, async (req, res, next) => {
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

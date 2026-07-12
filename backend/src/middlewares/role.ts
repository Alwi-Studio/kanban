import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { getUserRole } from "../services/member";
import { AppError } from "./errorHandler";


export function requireRole(...roles: string[]) {
  return (lookup: "board" | "column" | "task" = "board") =>
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        let boardId: string | null = null;
        if (lookup === "board") {
          boardId = req.params.id || req.body.board_id;
        } else if (lookup === "column") {
          const col = await prisma.column.findUnique({ where: { id: req.params.id } });
          boardId = col?.boardId || null;
        } else {
          const task = await prisma.task.findUnique({
            where: { id: req.params.id },
            select: { column: { select: { boardId: true } } },
          });
          boardId = task?.column.boardId || null;
        }
        if (!boardId || !req.user) return next(new AppError(403, "Forbidden"));
        const role = await getUserRole(boardId, req.user.userId);
        if (!role || !roles.includes(role)) return next(new AppError(403, "Insufficient permissions"));
        next();
      } catch (err) {
        next(err);
      }
    };
}

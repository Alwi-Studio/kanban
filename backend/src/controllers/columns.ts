import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import * as columnService from "../services/columns";
import { createLog } from "../services/activityLog";
import { emitBoardEvent } from "../sockets";


export async function createColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    const column = await columnService.createColumn(req.params.id, name);
    if (req.user) await createLog(req.params.id, req.user.userId, `Added column "${name}"`);
    emitBoardEvent(req.params.id, "column:created", column);
    res.status(201).json(column);
  } catch (err) { next(err); }
}

export async function updateColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, position } = req.body;
    const column = await columnService.updateColumn(req.params.id, { name, position });
    if (name && req.user) {
      const col = await prisma.column.findUnique({ where: { id: req.params.id }, select: { boardId: true } });
      if (col) await createLog(col.boardId, req.user.userId, `Renamed column to "${name}"`);
      emitBoardEvent(col!.boardId, "column:updated", column);
    }
    res.json(column);
  } catch (err) { next(err); }
}

export async function deleteColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const col = await prisma.column.findUnique({ where: { id: req.params.id }, select: { boardId: true, name: true } });
    if (col && req.user) await createLog(col.boardId, req.user.userId, `Deleted column "${col.name}"`);
    await columnService.deleteColumn(req.params.id);
    if (col) emitBoardEvent(col.boardId, "column:deleted", { id: req.params.id });
    res.json({ message: "Column deleted" });
  } catch (err) { next(err); }
}

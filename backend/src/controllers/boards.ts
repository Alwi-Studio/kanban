import { Request, Response, NextFunction } from "express";
import * as boardService from "../services/boards";
import { createLog } from "../services/activityLog";
import prisma from "../lib/prisma";

export async function listBoards(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id || typeof workspace_id !== "string") {
      return res.status(400).json({ error: "workspace_id query parameter is required" });
    }
    const boards = await boardService.listBoards(workspace_id, req.user!.userId);
    res.json(boards);
  } catch (err) { next(err); }
}

export async function getBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await boardService.getBoard(req.params.id, req.user!.userId);
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json(board);
  } catch (err) { next(err); }
}

export async function createBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspace_id, name } = req.body;
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspace_id, ownerId: req.user!.userId },
      select: { id: true },
    });
    if (!workspace) return res.status(403).json({ error: "You cannot create a board in this workspace" });
    const board = await boardService.createBoard(workspace_id, name, req.user!.userId);
    res.status(201).json(board);
  } catch (err) { next(err); }
}

export async function updateBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    const board = await boardService.updateBoard(req.params.id, name);
    if (req.user) await createLog(req.params.id, req.user.userId, `Renamed board to "${name}"`);
    res.json(board);
  } catch (err) { next(err); }
}

export async function deleteBoard(req: Request, res: Response, next: NextFunction) {
  try {
    await boardService.deleteBoard(req.params.id);
    res.json({ message: "Board deleted" });
  } catch (err) { next(err); }
}

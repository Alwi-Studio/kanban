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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isGlobalAdmin: true } });
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspace_id, ...(user?.isGlobalAdmin ? {} : { ownerId: req.user!.userId }) },
      select: { id: true },
    });
    if (!workspace) return res.status(403).json({ error: "You cannot create a board in this workspace" });
    const board = await boardService.createBoard(workspace_id, name, req.user!.userId);
    res.status(201).json(board);
  } catch (err) { next(err); }
}

export async function updateBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, isGlobal } = req.body;
    // Only global admins may change a board's public visibility. Board
    // admins/owners can still rename the board.
    if (isGlobal !== undefined) {
      const actor = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isGlobalAdmin: true } });
      if (!actor?.isGlobalAdmin) {
        return res.status(403).json({ error: "Only a global admin can make a board public" });
      }
    }
    const board = await boardService.updateBoard(req.params.id, { name, isGlobal });
    if (req.user) {
      if (name !== undefined) await createLog(req.params.id, req.user.userId, `Renamed board to "${name}"`);
      if (isGlobal !== undefined) await createLog(req.params.id, req.user.userId, isGlobal ? "Made board public" : "Made board private");
    }
    res.json(board);
  } catch (err) { next(err); }
}

export async function deleteBoard(req: Request, res: Response, next: NextFunction) {
  try {
    await boardService.deleteBoard(req.params.id);
    res.json({ message: "Board deleted" });
  } catch (err) { next(err); }
}

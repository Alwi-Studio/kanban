import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import * as taskService from "../services/tasks";
import * as taskDetailsService from "../services/taskDetails";
import { emitBoardEvent } from "../sockets";
import { createLog } from "../services/activityLog";
import { createNotification } from "../services/notification";

async function emitTaskSnapshot(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      column: { select: { boardId: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      taskLabels: { include: { label: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });
  if (!task) return;
  const { column, ...payload } = task;
  emitBoardEvent(column.boardId, "task:updated", payload);
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description } = req.body;
    const task = await taskService.createTask(req.params.id, title, description);
    const col = await prisma.column.findUnique({ where: { id: req.params.id }, select: { boardId: true, name: true } });
    if (col && req.user) {
      await createLog(col.boardId, req.user.userId, `Added task "${title}" to ${col.name}`);
    }
    if (col) emitBoardEvent(col.boardId, "task:created", task);
    res.status(201).json(task);
  } catch (err) { next(err); }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, position, column_id, due_date, version } = req.body;
    const oldTask = await prisma.task.findUnique({ where: { id: req.params.id } });
    const task = await taskService.updateTask(req.params.id, {
      title, description,
      position: position !== undefined ? position : undefined,
      columnId: column_id,
      dueDate: due_date !== undefined ? (due_date ? new Date(due_date) : null) : undefined,
      version,
    });
    const col = await prisma.column.findUnique({ where: { id: task.columnId }, select: { boardId: true, name: true } });
    if (col && req.user) {
      if (column_id && column_id !== oldTask?.columnId) {
        const fromCol = await prisma.column.findUnique({ where: { id: oldTask!.columnId }, select: { name: true } });
        await createLog(col.boardId, req.user.userId, `Moved task "${task.title}" from ${fromCol?.name} to ${col.name}`);
      } else if (title && title !== oldTask?.title) {
        await createLog(col.boardId, req.user.userId, `Renamed task to "${title}"`);
      }
    }
    if (col) emitBoardEvent(col.boardId, "task:updated", task);
    if (column_id || position !== undefined) emitBoardEvent(col!.boardId, "board:refresh", { boardId: col!.boardId });
    res.json(task);
  } catch (err) { next(err); }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { column: true } });
    if (task && req.user) {
      await createLog(task.column.boardId, req.user.userId, `Deleted task "${task.title}"`);
    }
    await taskService.deleteTask(req.params.id);
    if (task) emitBoardEvent(task.column.boardId, "task:deleted", { id: req.params.id, boardId: task.column.boardId });
    res.json({ message: "ok" });
  } catch (err) { next(err); }
}

export async function addAssignee(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id } = req.body;
    const assignee = await taskDetailsService.addAssignee(req.params.id, user_id);
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { column: true } });
    if (task && req.user) {
      await createLog(task.column.boardId, req.user.userId, `Assigned user to task "${task.title}"`);
      await createNotification(user_id, task.column.boardId, task.id, `You were assigned to "${task.title}"`);
    }
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId) emitBoardEvent(boardId, "task:assignee:added", assignee);
    await emitTaskSnapshot(req.params.id);
    res.status(201).json(assignee);
  } catch (err) { next(err); }
}

export async function removeAssignee(req: Request, res: Response, next: NextFunction) {
  try {
    await taskDetailsService.removeAssignee(req.params.id, req.params.userId);
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId) emitBoardEvent(boardId, "task:assignee:removed", { taskId: req.params.id, userId: req.params.userId });
    await emitTaskSnapshot(req.params.id);
    res.json({ message: "ok" });
  } catch (err) { next(err); }
}

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await taskDetailsService.addComment(req.params.id, req.user!.userId, req.body.content);
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { column: true, assignees: true } });
    if (task && req.user) {
      await createLog(task.column.boardId, req.user.userId, `Commented on task "${task.title}"`);
      for (const a of task.assignees) {
        if (a.userId !== req.user.userId) {
          await createNotification(a.userId, task.column.boardId, task.id, `New comment on "${task.title}"`);
        }
      }
    }
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId) emitBoardEvent(boardId, "task:comment:added", comment);
    await emitTaskSnapshot(req.params.id);
    res.status(201).json(comment);
  } catch (err) { next(err); }
}

export async function getComments(req: Request, res: Response, next: NextFunction) {
  try {
    const comments = await taskDetailsService.getComments(req.params.id);
    res.json(comments);
  } catch (err) { next(err); }
}

export async function addAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = (file as any).path?.startsWith("http") ? (file as any).path : `/uploads/${file.filename}`;
    const attachment = await taskDetailsService.addAttachment(req.params.id, fileUrl, file.originalname, file.size);
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId && req.user) {
      const task = await prisma.task.findUnique({ where: { id: req.params.id } });
      await createLog(boardId, req.user.userId, `Attached "${file.originalname}" to task "${task?.title}"`);
    }
    if (boardId) emitBoardEvent(boardId, "task:attachment:added", attachment);
    await emitTaskSnapshot(req.params.id);
    res.status(201).json(attachment);
  } catch (err) { next(err); }
}

export async function getAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const attachments = await taskDetailsService.getAttachments(req.params.id);
    res.json(attachments);
  } catch (err) { next(err); }
}

export async function addLabelToTask(req: Request, res: Response, next: NextFunction) {
  try {
    const tl = await taskDetailsService.addLabelToTask(req.params.id, req.params.labelId);
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId) emitBoardEvent(boardId, "task:label:added", tl);
    await emitTaskSnapshot(req.params.id);
    res.status(201).json(tl);
  } catch (err) { next(err); }
}

export async function removeLabelFromTask(req: Request, res: Response, next: NextFunction) {
  try {
    await taskDetailsService.removeLabelFromTask(req.params.id, req.params.labelId);
    const boardId = await taskDetailsService.getTaskBoards(req.params.id);
    if (boardId) emitBoardEvent(boardId, "task:label:removed", { taskId: req.params.id, labelId: req.params.labelId });
    await emitTaskSnapshot(req.params.id);
    res.json({ message: "Label removed" });
  } catch (err) { next(err); }
}

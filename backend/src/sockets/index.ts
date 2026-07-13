import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import prisma from "../lib/prisma";
import type { AuthPayload } from "../middlewares/auth";

let io: Server;

export function setupSocket(_io: Server) {
  io = _io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.on("board:join", async (boardId: string) => {
      if (typeof boardId !== "string") return;
      try {
        const membership = await prisma.boardMember.findFirst({
          where: { boardId, userId: socket.data.userId },
          select: { id: true },
        });
        if (membership) socket.join(`board:${boardId}`);
        else socket.emit("board:error", { boardId, message: "Forbidden" });
      } catch {
        socket.emit("board:error", { boardId, message: "Could not join board" });
      }
    });

    socket.on("board:leave", (boardId: string) => {
      if (typeof boardId === "string") socket.leave(`board:${boardId}`);
    });
  });
}

export function getIO(): Server {
  return io;
}

export function emitBoardEvent(boardId: string, event: string, data: unknown) {
  io?.to(`board:${boardId}`).emit(event, data);
}

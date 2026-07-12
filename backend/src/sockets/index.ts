import { Server, Socket } from "socket.io";

let io: Server;

export function setupSocket(_io: Server) {
  io = _io;

  io.on("connection", (socket: Socket) => {
    socket.on("board:join", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("board:leave", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on("disconnect", () => {});
  });
}

export function getIO(): Server {
  return io;
}

export function emitBoardEvent(boardId: string, event: string, data: unknown) {
  io?.to(`board:${boardId}`).emit(event, data);
}

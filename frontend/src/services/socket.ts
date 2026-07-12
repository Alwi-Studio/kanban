import { io, Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io(API_BASE, {
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinBoard(boardId: string) {
  socket?.emit("board:join", boardId);
}

export function leaveBoard(boardId: string) {
  socket?.emit("board:leave", boardId);
}

export function getSocket() {
  return socket;
}

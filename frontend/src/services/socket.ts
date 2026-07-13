import { io, Socket } from "socket.io-client";
import { API_BASE, getAccessToken } from "./api";

let socket: Socket | null = null;

export function connectSocket() {
  if (socket) return socket;
  socket = io(API_BASE, {
    transports: ["websocket", "polling"],
    auth: { token: getAccessToken() },
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

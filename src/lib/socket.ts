import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";

let socket: Socket | null = null;
let activeToken: string | null = null;

export function connectSocket(token: string): Socket {
  if (socket && socket.connected && activeToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  activeToken = token;
  socket = io(API_BASE_URL, {
    transports: ["websocket"],
    auth: {
      token: `Bearer ${token}`,
    },
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  activeToken = null;
}

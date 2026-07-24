import socket, { Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const initializeSocket = (projectId: string) => {
  // Reuse the existing connection if one is already open for this project,
  // so we don't create duplicate sockets (and duplicate listeners) on re-mounts.
  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = socket(import.meta.env.VITE_API_URL, {
    auth: {
      token: localStorage.getItem("token"),
    },
    query: {
      projectId,
    },
  });

  return socketInstance;
};

// Registers a listener and RETURNS an unsubscribe function so callers can clean
// up in a useEffect return. Without cleanup, listeners stack on every re-render
// and fire N times (the "so many toasts" bug).
export const receiveMessage = (
  eventName: string,
  cb: (...args: any[]) => void
): (() => void) => {
  if (socketInstance) {
    socketInstance.on(eventName, cb);
    return () => {
      socketInstance?.off(eventName, cb);
    };
  } else {
    console.error("Socket instance is not initialized.");
    return () => {};
  }
};

export const stopReceiving = (eventName: string): void => {
  socketInstance?.off(eventName);
};

export const sendMessage = (eventName: string, data: any): void => {
  if (socketInstance) {
    socketInstance.emit(eventName, data);
  } else {
    console.error("Socket instance is not initialized.");
  }
};

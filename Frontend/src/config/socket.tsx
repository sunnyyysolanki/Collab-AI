import socket, { Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export const initializeSocket = (projectId: string) => {
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

export const receiveMessage = (
  eventName: string,
  cb: (...args: any[]) => void
): void => {
  if (socketInstance) {
    socketInstance.on(eventName, cb);
  } else {
    console.error("Socket instance is not initialized.");
  }
};

export const sendMessage = (eventName: string, data: any): void => {
  console.log(data);
  if (socketInstance) {
    socketInstance.emit(eventName, data);
  } else {
    console.error("Socket instance is not initialized.");
  }
};

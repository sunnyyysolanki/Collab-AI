import { Client, IMessage } from "@stomp/stompjs";

let stompClient: Client | null = null;
let currentProjectId: string | null = null;

// Map of eventName -> Set of callbacks
const messageHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();
// Map of eventName -> StompSubscription
const activeSubscriptions: Map<string, any> = new Map();

export const initializeSocket = (projectId: string) => {
  if (stompClient?.active && currentProjectId === projectId) {
    return stompClient;
  }

  currentProjectId = projectId;
  
  let wsUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
  wsUrl = wsUrl.replace(/^http/, "ws") + "/ws";
  
  const token = localStorage.getItem("token") || "";

  stompClient = new Client({
    brokerURL: wsUrl,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
      projectId: projectId,
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: () => {
      console.log("Connected to STOMP via WebSocket");
      // Re-subscribe to all events that have handlers
      messageHandlers.forEach((_, eventName) => {
        subscribeToEvent(eventName);
      });
    },
    onStompError: (frame) => {
      console.error("Broker reported error: " + frame.headers["message"]);
      console.error("Additional details: " + frame.body);
    }
  });

  stompClient.activate();
  return stompClient;
};

const subscribeToEvent = (eventName: string) => {
  if (!stompClient || !stompClient.connected || !currentProjectId) return;
  
  // Don't subscribe twice
  if (activeSubscriptions.has(eventName)) return;
  
  const destination = `/topic/project/${currentProjectId}/${eventName}`;
  const sub = stompClient.subscribe(destination, (message: IMessage) => {
    let parsedData: any;
    if (message.body) {
      try {
        parsedData = JSON.parse(message.body);
      } catch (e) {
        parsedData = message.body;
      }
    }
    
    // Notify all handlers for this event
    const handlers = messageHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(cb => cb(parsedData));
    }
  });
  
  activeSubscriptions.set(eventName, sub);
};

export const receiveMessage = (
  eventName: string,
  cb: (...args: any[]) => void
): (() => void) => {
  if (!messageHandlers.has(eventName)) {
    messageHandlers.set(eventName, new Set());
  }
  messageHandlers.get(eventName)!.add(cb);

  if (stompClient && stompClient.connected) {
    subscribeToEvent(eventName);
  }

  return () => {
    const handlers = messageHandlers.get(eventName);
    if (handlers) {
      handlers.delete(cb);
      if (handlers.size === 0) {
        messageHandlers.delete(eventName);
        // Unsubscribe from STOMP
        const sub = activeSubscriptions.get(eventName);
        if (sub) {
          sub.unsubscribe();
          activeSubscriptions.delete(eventName);
        }
      }
    }
  };
};

export const stopReceiving = (eventName: string): void => {
  messageHandlers.delete(eventName);
  const sub = activeSubscriptions.get(eventName);
  if (sub) {
    sub.unsubscribe();
    activeSubscriptions.delete(eventName);
  }
};

export const sendMessage = (eventName: string, data: any): void => {
  if (stompClient && stompClient.connected && currentProjectId) {
    stompClient.publish({
      destination: `/app/project/${currentProjectId}/${eventName}`,
      body: JSON.stringify(data),
    });
  } else {
    console.error("STOMP instance is not initialized or connected.");
  }
};

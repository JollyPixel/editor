// Import Third-party Dependencies
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";

// Import Internal Dependencies
import { appRouter } from "./api/index.js";
import { createContext } from "./context.js";

const wss = new WebSocketServer({
  port: 3001
});
const handler = applyWSSHandler({
  wss: wss as any,
  router: appRouter,
  createContext,
  keepAlive: {
    enabled: true,
    pingMs: 30000,
    pongWaitMs: 5000
  }
});
wss.on("connection", (ws) => {
  console.log(`➕➕ Connection (${wss.clients.size})`);
  ws.once("close", () => {
    console.log(`➖➖ Connection (${wss.clients.size})`);
  });
});

console.log("✅ WebSocket Server listening on ws://localhost:3001");
process.on("SIGTERM", () => {
  console.log("SIGTERM");
  handler.broadcastReconnectNotification();
  wss.close();
});

export type AppRouter = typeof appRouter;

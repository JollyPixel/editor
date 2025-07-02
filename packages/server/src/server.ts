// Import Third-party Dependencies
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";

// Import Internal Dependencies
import { appRouter } from "./api/index.js";

export function createContext() {
  return {};
}

export function createServer() {
  // TODO: use configuration for port ?
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

  return { wss, handler };
}

export type AppRouter = typeof appRouter;

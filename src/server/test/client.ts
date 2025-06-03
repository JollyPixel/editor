// Import Third-party Dependencies
import {
  createTRPCClient,
  createWSClient,
  wsLink
} from "@trpc/client";

// Import Internal Dependencies
import type { AppRouter } from "../src/server.js";

export function openWebsocketClient() {
  const wss = createWSClient({
    url: "ws://localhost:3001"
  });

  const trpc = createTRPCClient<AppRouter>({
    links: [
      wsLink({ client: wss })
    ]
  });

  return {
    wss,
    trpc
  };
}

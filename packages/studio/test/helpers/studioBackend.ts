// Import Node.js Dependencies
import http from "node:http";
import type { AddressInfo } from "node:net";

// Import Third-party Dependencies
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";

// Import Internal Dependencies
import { StudioBackend } from "../../server/StudioBackend.ts";
import {
  STUDIO_ROOT,
  StudioProject
} from "../../server/project/StudioProject.ts";

export interface ServedBackend extends AsyncDisposable {
  url: URL;
  socketUrl: string;
}

export interface ServeBackendOptions {
  /**
   * @default "member"
   */
  defaultRole?: string;
}

export async function serveBackend(
  options: ServeBackendOptions = {}
): Promise<ServedBackend> {
  const project = await StudioProject.open(
    StudioProject.resolveRoot(STUDIO_ROOT, {}),
    {
      inMemory: true
    }
  );
  const backend = await StudioBackend.open(project, {
    inMemory: true,
    accounts: {
      inMemory: true,
      defaultRole: options.defaultRole ?? "member"
    }
  });
  const server = http.createServer((request, response) => {
    backend.middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  backend.attach(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: new URL(`http://127.0.0.1:${port}/`),
    socketUrl: `ws://127.0.0.1:${port}${DEFAULT_WEBSOCKET_PATH}`,
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => {
        server.close(resolve);
      });
      await backend[Symbol.asyncDispose]();
    }
  };
}

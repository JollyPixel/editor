// Import Node.js Dependencies
import { mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { preview } from "vite";

// Import Internal Dependencies
import {
  Client,
  connectWebSocket
} from "#src/index.ts";
import { createWebSocketNetworkPlugin } from "#src/plugins/vite.ts";
import { DEFAULT_WEBSOCKET_PATH } from "#src/transport/constants.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";

describe("createWebSocketNetworkPlugin", () => {
  test("serves rooms from vite preview", async(t) => {
    const outDir = await mkdtemp(path.join(tmpdir(), "network-preview-"));
    t.after(() => rmdir(outDir));

    const extension = new RecordingExtension("test-ns");
    const server = await preview({
      configFile: false,
      logLevel: "silent",
      root: outDir,
      build: {
        outDir
      },
      preview: {
        port: 0,
        host: "127.0.0.1"
      },
      plugins: [
        createWebSocketNetworkPlugin({
          extensions: [extension]
        })
      ]
    });
    t.after(() => server.close());

    const address = server.httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }

    const client = new Client({
      socket: () => connectWebSocket({
        url: `ws://127.0.0.1:${address.port}${DEFAULT_WEBSOCKET_PATH}`
      })
    });
    t.after(() => client.destroy());
    client.room("test-ns").join();

    await waitFor(() => extension.connected.length === 1);
  });
});

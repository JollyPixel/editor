// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { ViteDevServer } from "vite";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH
} from "@jolly-pixel/server";
import type { PlayerPageSource } from "@jolly-pixel/server/node";

export class ServedPlayerPage implements PlayerPageSource {
  readonly #server: ViteDevServer;

  constructor(
    server: ViteDevServer
  ) {
    this.#server = server;
  }

  async html(): Promise<string> {
    const page = await fs.readFile(
      path.join(this.#server.config.root, PLAY_PAGE_PATH),
      "utf8"
    );

    return this.#server.transformIndexHtml(`/${PLAY_PAGE_DIR}/`, page);
  }
}

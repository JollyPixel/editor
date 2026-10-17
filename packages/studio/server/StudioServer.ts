// Import Node.js Dependencies
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

// Import Third-party Dependencies
import { compose } from "@openally/servo";

// Import Internal Dependencies
import { EDITOR_PAGES_DIR } from "../src/editors/EditorDescriptor.ts";
import { ManifestRoute } from "./editors/ManifestRoute.ts";
import type { StudioProject } from "./project/StudioProject.ts";
import { serveBuild } from "./serveBuild.ts";
import {
  StudioBackend,
  type StudioBackendOptions
} from "./StudioBackend.ts";

export interface StudioServerOptions {
  project: StudioProject;
  /**
   * Folder of the built studio shell, holding its `index.html` and the page
   * of every project editor under `editors/<name>/`.
   */
  shell: string;
  backend?: StudioBackendOptions;
  /**
   * Host header values accepted on the WebSocket upgrade, besides localhost
   * and IP addresses.
   * @default []
   */
  allowedHosts?: readonly string[];
}

export class StudioServer implements AsyncDisposable {
  static async open(
    options: StudioServerOptions
  ): Promise<StudioServer> {
    const pages = [
      path.join(options.shell, "index.html"),
      ...Array.from(options.project.editors, (editor) => path.join(
        options.shell,
        EDITOR_PAGES_DIR,
        editor.name,
        "index.html"
      ))
    ];
    await Promise.all(pages.map(requireBuiltPage));

    return new StudioServer(
      options,
      await StudioBackend.open(options.project, options.backend)
    );
  }

  #backend: StudioBackend;
  #http: http.Server;

  private constructor(
    options: StudioServerOptions,
    backend: StudioBackend
  ) {
    this.#backend = backend;
    const pages = compose(
      new ManifestRoute(options.project).middleware,
      serveBuild(options.shell)
    );
    this.#http = http.createServer((request, response) => {
      backend.middleware(request, response, () => {
        pages(request, response);
      });
    });
    backend.attach(this.#http, {
      allowedHosts: options.allowedHosts ?? []
    });
  }

  async listen(
    port: number,
    host: string
  ): Promise<URL> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.#http.once("error", reject);
    this.#http.listen(port, host, () => {
      this.#http.off("error", reject);
      resolve();
    });
    await promise;

    const address = this.#http.address();
    if (address === null || typeof address === "string") {
      throw new Error("The studio is not listening on a TCP address.");
    }
    const hostname = address.family === "IPv6" ?
      `[${address.address}]` :
      address.address;

    return new URL(`http://${hostname}:${address.port}/`);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    const closed = new Promise<void>((resolve) => {
      this.#http.close(() => resolve());
    });
    this.#http.closeAllConnections();
    await this.#backend[Symbol.asyncDispose]();
    await closed;
  }
}

async function requireBuiltPage(
  page: string
): Promise<void> {
  try {
    await fs.access(page);
  }
  catch (error) {
    throw new Error(
      `"${page}" is missing: build the studio before serving it.`,
      { cause: error }
    );
  }
}

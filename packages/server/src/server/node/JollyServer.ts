// Import Node.js Dependencies
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

// Import Internal Dependencies
import { EditorPageFolders } from "../../editors/node/EditorPageFolders.ts";
import { BuiltPlayer } from "../../game/node/BuiltPlayer.ts";
import type { Project } from "../../project/node/Project.ts";
import { ShellPackages } from "../../project/node/ShellPackages.ts";
import type { ProjectHosting } from "../../projects/node/ProjectHosting.ts";
import { serveBuild } from "../../http/node/serveBuild.ts";
import {
  ServerBackend,
  type ServerBackendOptions
} from "./ServerBackend.ts";

export interface JollyServerOptions {
  hosting: ProjectHosting;
  /**
   * Opens the project found at a root of the hosting's registry.
   */
  openProject: (root: string) => Promise<Project>;
  /**
   * Folder of the built studio shell, holding its `index.html`, the
   * `project-manifest.json` of the packages it was compiled with, and the page
   * of every editor under `editors/<name>/`. A project listing an editor or
   * kind package the manifest lacks does not open.
   */
  shell: string;
  backend: Omit<
    ServerBackendOptions,
    | "hosting"
    | "openProject"
    | "shellPackages"
    | "editorPages"
    | "compression"
    | "allowedHosts"
    | "player"
    | "playPage"
  >;
  /**
   * Host header values accepted on the WebSocket upgrade, besides localhost
   * and IP addresses.
   * @default []
   */
  allowedHosts?: readonly string[];
  /**
   * Deflates socket messages over 1 KiB, and content fetched over HTTP whose
   * kind compresses.
   * @default false
   */
  compression?: boolean;
}

export class JollyServer implements AsyncDisposable {
  static async open(
    options: JollyServerOptions
  ): Promise<JollyServer> {
    const editorPages = EditorPageFolders.shell(options.shell);
    await requireBuiltPage(path.join(options.shell, "index.html"));
    const player = new BuiltPlayer(options.shell);

    return new JollyServer(
      options,
      await ServerBackend.open({
        ...options.backend,
        hosting: options.hosting,
        openProject: options.openProject,
        shellPackages: await ShellPackages.read(options.shell),
        editorPages,
        player,
        playPage: player,
        compression: options.compression,
        allowedHosts: options.allowedHosts ?? []
      })
    );
  }

  #backend: ServerBackend;
  #http: http.Server;

  private constructor(
    options: JollyServerOptions,
    backend: ServerBackend
  ) {
    this.#backend = backend;
    const shell = serveBuild(options.shell);
    this.#http = http.createServer((request, response) => {
      backend.middleware(request, response, () => shell(request, response));
    });
    backend.attach(this.#http, {
      ownsUpgrades: true
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

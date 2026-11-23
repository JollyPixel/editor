// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  type Connect,
  type InlineConfig,
  type Plugin
} from "vite";
import {
  PLAYER_ARCHIVE_PATH,
  zipPlayer,
  type GamePlayer
} from "@jolly-pixel/server";
import { BuiltPlayer } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { PLAY_WORKER_PATH } from "../shared/playWorker.ts";

// CONSTANTS
const kWorkerEntry = "src/play/offline/playWorker.ts";
const kWorkerSources = `${path.sep}${path.join("src", "play", "offline")}${path.sep}`;
const kStaticMode = "static";

export function offlinePlay(): Plugin {
  let root = "";
  let outDir = "";
  let staticBuild = false;
  let worker: Promise<string> | null = null;

  return {
    name: "studio-offline-play",
    config(_config, env) {
      staticBuild = env.command === "build" && env.mode === kStaticMode;
    },
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(root, config.build.outDir);
    },
    configureServer(server) {
      server.watcher.on("change", (file) => {
        if (path.normalize(file).includes(kWorkerSources)) {
          worker = null;
        }
      });
      server.middlewares.use((request, response, next) => {
        const { pathname } = new URL(request.url ?? "/", "http://localhost");
        if (!pathname.endsWith(`/${PLAY_WORKER_PATH}`)) {
          next();

          return;
        }

        worker ??= buildPlayWorker(root);
        worker.then(
          (code) => {
            response.setHeader("content-type", "text/javascript");
            response.setHeader("cache-control", "no-store");
            response.end(code);
          },
          (error: unknown) => {
            worker = null;
            next(error);
          }
        );
      });
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: PLAY_WORKER_PATH,
        source: await buildPlayWorker(root)
      });
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        if (!staticBuild) {
          return;
        }

        const bundle = await new BuiltPlayer(outDir).bundle();
        await fs.writeFile(
          path.join(outDir, PLAYER_ARCHIVE_PATH),
          zipPlayer(bundle)
        );
      }
    }
  };
}

export function playerArchive(
  player: GamePlayer
): Connect.NextHandleFunction {
  return (request, response, next) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (!pathname.endsWith(`/${PLAYER_ARCHIVE_PATH}`)) {
      next();

      return;
    }

    player.bundle().then(
      (bundle) => {
        response.setHeader("content-type", "application/zip");
        response.setHeader("cache-control", "no-store");
        response.end(zipPlayer(bundle));
      },
      next
    );
  };
}

async function buildPlayWorker(
  root: string
): Promise<string> {
  const config: InlineConfig = {
    configFile: false,
    root,
    mode: "production",
    logLevel: "warn",
    publicDir: false,
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    },
    resolve: {
      conditions: [
        "module",
        "browser",
        "production"
      ]
    },
    build: {
      write: false,
      emptyOutDir: false,
      lib: {
        entry: path.join(root, kWorkerEntry),
        formats: ["iife"],
        name: "jollyPlayWorker",
        fileName: () => PLAY_WORKER_PATH
      }
    }
  };
  const result = await build(config);
  const outputs = Array.isArray(result) ? result : [result];
  for (const output of outputs) {
    if ("output" in output) {
      const [chunk] = output.output;
      if (chunk.type === "chunk") {
        return chunk.code;
      }
    }
  }

  throw new Error("the play worker build emitted no script");
}

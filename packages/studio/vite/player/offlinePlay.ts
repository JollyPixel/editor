// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type {
  Connect,
  Plugin
} from "vite";
import {
  PLAYER_ARCHIVE_PATH,
  zipPlayer,
  type GamePlayer
} from "@jolly-pixel/server";
import {
  BuiltPlayer,
  readPathname
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import { PLAY_WORKER_PATH } from "../../shared/playWorker.ts";
import {
  OnDemandBuild,
  PRODUCTION_BUILD,
  type BuildOutput
} from "./OnDemandBuild.ts";

// CONSTANTS
const kWorkerEntry = "src/play/offline/playWorker.ts";
const kStaticMode = "static";

export function offlinePlay(): Plugin {
  let outDir = "";
  let staticBuild = false;
  let worker: OnDemandBuild<string> | null = null;

  function playWorker(): Promise<string> {
    if (worker === null) {
      throw new Error("the play worker is built once the config resolves");
    }

    return worker.result();
  }

  return {
    name: "studio-offline-play",
    config(_config, env) {
      staticBuild = env.command === "build" && env.mode === kStaticMode;
    },
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      worker = new OnDemandBuild({
        config: {
          ...PRODUCTION_BUILD,
          root: config.root,
          build: {
            emptyOutDir: false,
            lib: {
              entry: path.join(config.root, kWorkerEntry),
              formats: ["iife"],
              name: "jollyPlayWorker",
              fileName: () => PLAY_WORKER_PATH
            }
          }
        },
        read: scriptCode
      });
    },
    configureServer(server) {
      server.middlewares.use(serveBuilt(
        PLAY_WORKER_PATH,
        "text/javascript",
        playWorker
      ));
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: PLAY_WORKER_PATH,
        source: await playWorker()
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
  return serveBuilt(
    PLAYER_ARCHIVE_PATH,
    "application/zip",
    async() => zipPlayer(await player.bundle())
  );
}

function serveBuilt(
  file: string,
  contentType: string,
  produce: () => Promise<string | Uint8Array>
): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (readPathname(request)?.endsWith(`/${file}`) !== true) {
      next();

      return;
    }

    produce().then(
      (body) => {
        response.setHeader("content-type", contentType);
        response.setHeader("cache-control", "no-store");
        response.end(body);
      },
      next
    );
  };
}

function scriptCode(
  output: BuildOutput
): string {
  const [chunk] = output;
  if (chunk.type !== "chunk") {
    throw new Error("the play worker build emitted no script");
  }

  return chunk.code;
}

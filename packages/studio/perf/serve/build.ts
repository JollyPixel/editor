// Import Node.js Dependencies
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { PORTS } from "@jolly-pixel/e2e";
import { StudioServer } from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_SHELL_DIR,
  studioSeed
} from "../../node/studioFiles.ts";
import { SHELL_PREFERENCES } from "../../shared/preferences.ts";
import { E2E_BACKEND_OPTIONS } from "../../vite/e2eBackend.ts";

const { values: args } = parseArgs({
  options: {
    port: { type: "string", default: String(PORTS.studio) },
    shell: { type: "string", default: STUDIO_SHELL_DIR },
    compression: { type: "boolean", default: false }
  }
});

const project = await openStudioProject({
  inMemory: true
});
const server = await StudioServer.open({
  project,
  shell: path.resolve(args.shell),
  compression: args.compression,
  backend: {
    inMemory: true,
    seed: await studioSeed(),
    preferences: SHELL_PREFERENCES,
    ...E2E_BACKEND_OPTIONS
  }
});
console.info(`Serving ${args.shell} on ${await server.listen(Number(args.port), "localhost")}`);

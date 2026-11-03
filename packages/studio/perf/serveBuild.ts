// Import Node.js Dependencies
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  STUDIO_ROOT,
  StudioProject
} from "../server/project/StudioProject.ts";
import { StudioServer } from "../server/StudioServer.ts";
import { E2E_BACKEND_OPTIONS } from "../vite/e2eBackend.ts";

const { values: args } = parseArgs({
  options: {
    port: { type: "string", default: String(PORTS.studio) },
    shell: { type: "string", default: path.join(STUDIO_ROOT, "dist") }
  }
});

const project = await StudioProject.open(
  StudioProject.resolveRoot(STUDIO_ROOT),
  { inMemory: true }
);
const server = await StudioServer.open({
  project,
  shell: path.resolve(args.shell),
  backend: {
    inMemory: true,
    ...E2E_BACKEND_OPTIONS
  }
});
console.info(`Serving ${args.shell} on ${await server.listen(Number(args.port), "localhost")}`);

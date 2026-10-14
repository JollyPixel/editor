// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import {
  STUDIO_ROOT,
  StudioProject
} from "./project/StudioProject.ts";
import { StudioServer } from "./StudioServer.ts";
import { StudioServerSettings } from "./StudioServerSettings.ts";

// CONSTANTS
const kShellDir = path.join(STUDIO_ROOT, "dist");
const kShutdownSignals = ["SIGINT", "SIGTERM"] as const;

const settings = StudioServerSettings.parse(process.env);
const project = await StudioProject.open(
  StudioProject.resolveRoot(STUDIO_ROOT)
);
const server = await StudioServer.open({
  project,
  shell: kShellDir,
  allowedHosts: settings.allowedHosts,
  backend: {
    trustProxy: settings.trustProxy,
    accounts: {
      env: process.env,
      logger: console
    }
  }
});
const url = await server.listen(settings.port, settings.host);
console.info(`Studio for "${project.file.root}" listening on ${url}`);

for (const signal of kShutdownSignals) {
  process.once(signal, () => {
    console.info(`${signal} received, closing the studio.`);
    server[Symbol.asyncDispose]().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

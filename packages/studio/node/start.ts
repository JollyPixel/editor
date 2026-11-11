// Import Third-party Dependencies
import {
  StudioServer,
  StudioServerSettings
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_SHELL_DIR,
  studioSeed
} from "./studioFiles.ts";
import { SHELL_PREFERENCES } from "../shared/preferences.ts";

// CONSTANTS
const kShutdownSignals = ["SIGINT", "SIGTERM"] as const;

const settings = StudioServerSettings.parse(process.env);
const project = await openStudioProject({
  settings
});
const server = await StudioServer.open({
  project,
  shell: STUDIO_SHELL_DIR,
  allowedHosts: settings.allowedHosts,
  compression: settings.compression,
  backend: {
    seed: await studioSeed(),
    preferences: SHELL_PREFERENCES,
    trustProxy: settings.trustProxy,
    accounts: {
      masterPassword: settings.masterPassword,
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

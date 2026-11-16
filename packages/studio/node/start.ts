// Import Third-party Dependencies
import {
  JollyServer,
  ServerSettings
} from "@jolly-pixel/server/node";

// Import Internal Dependencies
import {
  openStudioProject,
  STUDIO_ROOT,
  STUDIO_SHELL_DIR,
  studioSeed
} from "./studioFiles.ts";
import { SHELL_PREFERENCES } from "../shared/preferences.ts";

// CONSTANTS
const kShutdownSignals = ["SIGINT", "SIGTERM"] as const;

const settings = ServerSettings.parse(process.env);
const hosting = settings.hosting(STUDIO_ROOT);
const server = await JollyServer.open({
  hosting,
  openProject: (root) => openStudioProject({
    settings,
    root
  }),
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
console.info(`Studio listening on ${url}, its state in "${hosting.state}"`);

for (const signal of kShutdownSignals) {
  process.once(signal, () => {
    console.info(`${signal} received, closing the studio.`);
    server[Symbol.asyncDispose]().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

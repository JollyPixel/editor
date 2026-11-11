// Import Internal Dependencies
import {
  listenBackend,
  type ServeBackendOptions,
  type ServedBackend
} from "#src/testing/serveBackend.ts";
import {
  openTestProject,
  testSeed,
  UNBUILT_PLAYER
} from "./testProject.ts";

export async function serveBackend(
  options: ServeBackendOptions = {}
): Promise<ServedBackend> {
  return listenBackend(await openTestProject(), {
    ...options,
    seed: await testSeed(),
    player: UNBUILT_PLAYER
  });
}

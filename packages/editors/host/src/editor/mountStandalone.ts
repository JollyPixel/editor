// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import { EditorLaunch } from "../launch/EditorLaunch.ts";
import { defaultLaunchSources } from "../launch/sources/defaultLaunchSources.ts";
import type { LaunchSource } from "../launch/sources/LaunchSource.ts";
import { EditorSession } from "../session/EditorSession.ts";
import { exposeDebugHandle } from "./exposeDebugHandle.ts";

export interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  debugHandle?: string;
}

export async function mountStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions = {}
): Promise<THandle> {
  const launch = await EditorLaunch.read(
    options.sources ?? defaultLaunchSources()
  );
  const session = await EditorSession.open({
    launch,
    identity: definition.identity,
    kinds: definition.kinds,
    accepts: definition.accepts
  });

  let handle: THandle;
  try {
    handle = await definition.mount({
      launch,
      session
    });
  }
  catch (error) {
    session.dispose();

    throw error;
  }

  if (options.debugHandle !== undefined) {
    exposeDebugHandle(options.debugHandle, handle);
  }

  return handle;
}

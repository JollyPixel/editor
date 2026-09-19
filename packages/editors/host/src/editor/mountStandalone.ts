// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle,
  NoDevOptions
} from "./EditorDefinition.ts";
import { EditorLaunch } from "../launch/EditorLaunch.ts";
import {
  defaultLaunchSources,
  type LaunchSource
} from "../launch/LaunchSource.ts";
import { EditorSession } from "../session/EditorSession.ts";
import { exposeDebugHandle } from "../dev/exposeDebugHandle.ts";

export interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  debugHandle?: string;
}

export async function mountStandalone<
  THandle extends EditorHandle,
  TDev = NoDevOptions
>(
  definition: EditorDefinition<THandle, TDev>,
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
      session,
      dev: definition.dev?.read() ?? ({} as TDev)
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

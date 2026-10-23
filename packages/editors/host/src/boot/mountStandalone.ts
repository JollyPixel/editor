// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import { StandaloneEditor } from "./StandaloneEditor.ts";
import {
  readDebugLogger,
  type HostLogger
} from "../debug/readDebugLogger.ts";
import type { LaunchSource } from "../launch/index.ts";
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import type { StandaloneConnection } from "../connection/StandaloneConnection.ts";

export interface MountStandaloneOptions {
  /**
   * Read when the parent answers no `jolly-launch`.
   * @default [new QueryLaunchSource(), new InjectedLaunchSource()]
   */
  sources?: Iterable<LaunchSource>;
  dev?: boolean;
  debugHandle?: string;
  /**
   * Replaces the username prompt and the WebSocket client, for a back-end
   * that is not the page's asset server.
   */
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
  /**
   * Origins the parent's `jolly-launch` is accepted from.
   * @default [location.origin]
   */
  origins?: Iterable<string>;
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

export interface StandaloneMount<
  THandle extends EditorHandle
> extends LaunchNavigator {
  readonly handle: THandle;
  dispose(): void;
}

export async function mountStandalone<
  THandle extends EditorHandle
>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions = {}
): Promise<StandaloneMount<THandle>> {
  const {
    logger = readDebugLogger(),
    ...mountOptions
  } = options;
  const editor = new StandaloneEditor(definition, logger);
  try {
    return await editor.mount(mountOptions);
  }
  catch (error) {
    editor.dispose();

    throw error;
  }
}

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
import type { StandaloneConnection } from "../workspace/SessionWorkspace.ts";

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

export async function mountStandalone<
  THandle extends EditorHandle
>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions = {}
): Promise<THandle> {
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

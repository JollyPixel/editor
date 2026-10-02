// Import Third-party Dependencies
import type { CommandConsole } from "@jolly-pixel/console";
import type { Runtime } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type {
  EditorLaunch,
  ShellChannel
} from "../launch/index.ts";
import type {
  AssetDocumentKind
} from "../lease/AssetLease.ts";
import type { EditorRuntime } from "../runtime/EditorRuntime.ts";
import type {
  EditorIdentityOptions,
  EditorSession
} from "../session/EditorSession.ts";

export interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  shell: ShellChannel | null;
  logger: HostLogger;
  commands: CommandConsole;
}

export interface RuntimeEditorContext extends EditorContext {
  runtime: EditorRuntime;
}

export interface EditorHandle {
  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime | null;

  dispose(): void;
}

interface EditorDescription {
  readonly accepts: string;
  readonly identity: EditorIdentityOptions;
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;
}

export interface PageEditorDefinition<
  THandle extends EditorHandle
> extends EditorDescription {
  readonly createRuntime?: undefined;

  mount(
    context: EditorContext
  ): Promise<THandle>;
}

export interface RuntimeEditorDefinition<
  THandle extends EditorHandle
> extends EditorDescription {
  createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime>;

  mount(
    context: RuntimeEditorContext
  ): Promise<THandle>;
}

export type EditorDefinition<
  THandle extends EditorHandle
> =
  | PageEditorDefinition<THandle>
  | RuntimeEditorDefinition<THandle>;

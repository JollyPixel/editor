// Import Third-party Dependencies
import type { CommandConsole } from "@jolly-pixel/console";
import type { KeyboardLayoutStore } from "@jolly-pixel/controls";
import type { Lantern } from "@jolly-pixel/lantern";
import type { Preferences } from "@jolly-pixel/preferences";
import type { Runtime } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorLaunch } from "../launch/index.ts";
import type { ShellChannel } from "../shell/ShellChannel.ts";
import type {
  AssetDocumentKind
} from "../lease/AssetLease.ts";
import type { EditorRuntime } from "../runtime/EditorRuntime.ts";
import type { EditorSession } from "../session/EditorSession.ts";
import type {
  EditorArchiveLabels,
  EditorArchives
} from "../session/EditorArchives.ts";
import type { EditorIdentityOptions } from "../connection/server.ts";
import type { EditorToolbarSources } from "../session/EditorToolbarSources.ts";

export interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  toolbar: EditorToolbarSources;
  shell: ShellChannel | null;
  logger: HostLogger;
  commands: CommandConsole;
  lantern: Lantern;
  /**
   * The shell's preferences under a shell, otherwise `LocalPreferences`.
   */
  preferences: Preferences;
  keyboardLayout: KeyboardLayoutStore;
  archives: EditorArchives;
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
  readonly archive?: EditorArchiveLabels;
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

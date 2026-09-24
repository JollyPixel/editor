// Import Third-party Dependencies
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
import type {
  EditorIdentityOptions,
  EditorSession
} from "../session/EditorSession.ts";

export interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
  shell: ShellChannel | null;
  logger: HostLogger;
}

export interface EditorHandle {
  readonly ready: Promise<void>;
  readonly session: EditorSession;
  readonly runtime: Runtime | null;

  dispose(): void;
}

export interface EditorDefinition<
  THandle extends EditorHandle
> {
  readonly accepts: string;
  readonly identity: EditorIdentityOptions;
  readonly kinds: Iterable<AssetDocumentKind<unknown>>;

  mount(
    context: EditorContext
  ): Promise<THandle>;
}

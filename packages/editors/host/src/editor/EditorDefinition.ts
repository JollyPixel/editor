// Import Internal Dependencies
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
}

export interface EditorHandle {
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

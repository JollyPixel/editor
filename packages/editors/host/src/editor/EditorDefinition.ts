// Import Internal Dependencies
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import type { AssetModelKind } from "../session/AssetLease.ts";
import type {
  EditorIdentityOptions,
  EditorSession
} from "../session/EditorSession.ts";

export interface EditorContext {
  launch: EditorLaunch;
  session: EditorSession;
}

export interface EditorHandle {
  dispose(): void;
}

export interface EditorDefinition<
  THandle extends EditorHandle
> {
  readonly accepts: string;
  readonly identity: EditorIdentityOptions;
  readonly kinds: Iterable<AssetModelKind<unknown>>;
  mount(context: EditorContext): Promise<THandle>;
}

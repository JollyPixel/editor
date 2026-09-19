// Import Internal Dependencies
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import type { AssetModelKind } from "../session/AssetLease.ts";
import type {
  EditorIdentityOptions,
  EditorSession
} from "../session/EditorSession.ts";
import type { DevOptions } from "../dev/DevOptions.ts";

export type NoDevOptions = Record<string, never>;

export interface EditorContext<TDev = NoDevOptions> {
  launch: EditorLaunch;
  session: EditorSession;
  dev: TDev;
}

export interface EditorHandle {
  dispose(): void;
}

export interface EditorDefinition<
  THandle extends EditorHandle,
  TDev = NoDevOptions
> {
  readonly accepts: string;
  readonly identity: EditorIdentityOptions;
  readonly kinds: Iterable<AssetModelKind<unknown>>;
  readonly dev?: DevOptions<TDev>;
  mount(context: EditorContext<TDev>): Promise<THandle>;
}

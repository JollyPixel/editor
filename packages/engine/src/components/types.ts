// Import Internal Dependencies
import { Actor } from "../actor/Actor.ts";
import type { AssetManager } from "../systems/index.ts";

export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

export interface ComponentInitializeContext {
  assetManager: AssetManager;
}

export interface Component {
  actor: Actor<any>;
  typeName: FreeComponentEnum;
  needUpdate: boolean;

  initialize?(context: ComponentInitializeContext): Promise<void>;
  awake?(): void;
  start?(): void;
  update?(deltaTime: number): void;
  fixedUpdate?(deltaTime: number): void;
  destroy(): void;
}

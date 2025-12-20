// Import Internal Dependencies
import { Actor } from "../actor/Actor.ts";

export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TiledMapRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

export interface Component {
  actor: Actor;
  typeName: FreeComponentEnum;

  awake?(): void;
  start?(): void;
  update?(deltaTime: number): void;
  destroy(): void;
}

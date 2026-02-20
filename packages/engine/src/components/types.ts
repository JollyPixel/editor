// Import Internal Dependencies
import { Actor } from "../actor/Actor.ts";

export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

export interface Component {
  actor: Actor<any>;
  typeName: FreeComponentEnum;
  needUpdate: boolean;

  awake?(): void;
  start?(): void;
  update?(deltaTime: number): void;
  fixedUpdate?(deltaTime: number): void;
  destroy(): void;
}

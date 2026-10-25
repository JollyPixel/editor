// Import Internal Dependencies
import type { Actor } from "../actor/Actor.ts";

export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "MeshRenderer"
  | "Light"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

export interface Component {
  actor: Actor<any>;
  typeName: FreeComponentEnum;
  needUpdate: boolean;
  pendingForDestruction: boolean;

  bind?(): void;
  awake?(): void;
  start?(): void;
  update?(
    deltaTime: number,
    alpha?: number
  ): void;
  fixedUpdate?(
    deltaTime: number,
    stepIndex?: number
  ): void;
  destroy(): void;
}

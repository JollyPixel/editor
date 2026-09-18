// Import Internal Dependencies
import type { Actor } from "../actor/Actor.ts";

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
  pendingForDestruction: boolean;

  bind?(): void;
  awake?(): void;
  start?(): void;
  /**
   * Called per rendered frame. Use `alpha` in [0, 1) for interpolation.
   */
  update?(
    deltaTime: number,
    alpha?: number
  ): void;
  /**
   * Called per fixed step. `stepIndex` starts at zero for each frame.
   */
  fixedUpdate?(
    deltaTime: number,
    stepIndex?: number
  ): void;
  destroy(): void;
}

// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { SceneAsset } from "./SceneAsset.ts";
import { SCENE_GOLEM_KIND } from "./sceneGolemKind.ts";

export * from "./SceneAsset.ts";
export type {
  ActorSpec,
  AddedActor,
  ComponentSpec
} from "./ActorSpec.ts";
export type {
  AssetRef,
  AssetReference
} from "./SceneRefs.ts";
export type { SceneComponentDeclaration } from "./SceneComponentTypes.ts";
export * from "./errors/ComponentSlotError.ts";
export * from "./errors/UnknownComponentError.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    scene: SceneAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  SCENE_GOLEM_KIND
];

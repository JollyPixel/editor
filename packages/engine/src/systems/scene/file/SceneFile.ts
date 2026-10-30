// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue; };

export type JSONObject = { [key: string]: JSONValue; };

export interface Vector3JSON {
  x: number;
  y: number;
  z: number;
}

export type ColorJSON = string;

export interface SceneTransformFile {
  position: Vector3JSON;
  /**
   * Euler angles in degrees, XYZ order.
   */
  rotation: Vector3JSON;
  scale: Vector3JSON;
}

export interface SceneComponentFile {
  id: string;
  type: string;
  data: JSONObject;
  assets: Record<string, AssetReferenceData | null>;
}

export interface SceneAnchorFile {
  /**
   * A component of the actor's parent.
   */
  component: string;
  key: string;
}

export interface SceneActorOverrideFile {
  name?: string;
  visible?: boolean;
  transform?: Partial<SceneTransformFile>;
}

export interface SceneComponentOverrideFile {
  /**
   * Top-level fields that replace those of the component data.
   */
  data?: JSONObject;
  assets?: Record<string, AssetReferenceData | null>;
}

export interface SceneOverridesFile {
  /**
   * Keyed by the path of the actor below the instance.
   */
  actors?: Record<string, SceneActorOverrideFile>;
  /**
   * Keyed by the path of the component below the instance.
   */
  components?: Record<string, SceneComponentOverrideFile>;
}

export interface SceneActorFile {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
  /**
   * Relative to the anchor when the actor has one, else to its parent.
   */
  transform: SceneTransformFile;
  components: SceneComponentFile[];
  /**
   * A scene expanded under this actor.
   */
  prefab?: AssetReferenceData;
  /**
   * Changes to the actors `prefab` expands.
   */
  overrides?: SceneOverridesFile;
  anchor?: SceneAnchorFile;
}

export type SceneEnvironmentKind = "none" | "room";

export type SceneFogFile =
  | { kind: "none"; }
  | { kind: "linear"; color: ColorJSON; near: number; far: number; }
  | { kind: "exp2"; color: ColorJSON; density: number; };

export interface SceneEnvironmentFile {
  background: ColorJSON | null;
  environment: {
    kind: SceneEnvironmentKind;
    intensity: number;
  };
  fog: SceneFogFile;
}

export interface SceneFile {
  version: 1;
  environment: SceneEnvironmentFile;
  /**
   * Every actor in tree order: an actor follows its parent and siblings
   * follow their display order.
   */
  actors: SceneActorFile[];
}

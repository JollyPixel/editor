// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import type {
  Matrix4,
  Quaternion,
  Vector3
} from "../../math.ts";
import type {
  World,
  WorldAudio
} from "../World.ts";
import type { SceneEnvironmentFile } from "./file/SceneFile.ts";

export interface ActorNode {
  attach(
    parent: ActorNode | null
  ): void;
  seat(
    socket: Readonly<Matrix4> | null
  ): void;
  rename(
    name: string
  ): void;
  show(
    visible: boolean
  ): void;
  enableLayer(
    layer: number
  ): void;
  place(
    position: Readonly<Vector3>,
    quaternion: Readonly<Quaternion>,
    scale: Readonly<Vector3>
  ): void;
  dispose(): void;
}

export const DETACHED_ACTOR_NODE: ActorNode = Object.freeze({
  attach: () => undefined,
  seat: () => undefined,
  rename: () => undefined,
  show: () => undefined,
  enableLayer: () => undefined,
  place: () => undefined,
  dispose: () => undefined
});

export interface SceneEnvironment {
  apply(
    file: SceneEnvironmentFile
  ): void;
  dispose(): void;
}

export interface SceneGraph {
  createNode(
    actor: Actor<any>
  ): ActorNode;
  createEnvironment(
    world: World<any, any>
  ): SceneEnvironment;
  createAudio(): WorldAudio;
  prune(
    survivors: Iterable<ActorNode>
  ): void;
}

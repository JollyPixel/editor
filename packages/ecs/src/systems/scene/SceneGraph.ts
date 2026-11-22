// Import Third-party Dependencies
import type {
  Mat4,
  Quat,
  Vec3
} from "@jolly-pixel/math";

// Import Internal Dependencies
import type { Actor } from "../../actor/Actor.ts";
import type {
  World,
  WorldAudio
} from "../World.ts";
import type { EnvironmentFile } from "../environment/EnvironmentFile.ts";

export interface ActorNode {
  attach(
    parent: ActorNode | null
  ): void;
  seat(
    socket: Readonly<Mat4> | null
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
    position: Readonly<Vec3>,
    quaternion: Readonly<Quat>,
    scale: Readonly<Vec3>
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
    file: Readonly<EnvironmentFile>
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

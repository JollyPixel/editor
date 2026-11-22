// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  Actor,
  Mat4,
  Quat,
  Vec3,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import type { ThreeRenderComponent } from "../rendering/ThreeRenderComponent.ts";
import type { PostProcessing } from "../rendering/compositing/PostProcessing.ts";
import { disposeObject3D } from "../utils/disposeObject3D.ts";
import { ThreeSceneEnvironment } from "./ThreeSceneEnvironment.ts";

declare module "@jolly-pixel/ecs" {
  interface SceneBackend {
    node: ThreeActorNode;
    graph: ThreeSceneGraph;
    audio: GlobalAudio;
    renderComponent: ThreeRenderComponent;
  }
}

// CONSTANTS
const kActors = new WeakMap<THREE.Object3D, Actor<any>>();
const kSocketMatrix = new THREE.Matrix4();

export class ThreeActorNode implements Systems.ActorNode {
  readonly object3D = new THREE.Group();

  #scene: THREE.Scene;
  #socket: THREE.Group | null = null;

  constructor(
    actor: Actor<any>,
    scene: THREE.Scene
  ) {
    this.#scene = scene;
    this.object3D.userData.isActor = true;
    kActors.set(this.object3D, actor);
  }

  get root(): THREE.Object3D {
    return this.#socket ?? this.object3D;
  }

  attach(
    parent: Systems.ActorNode | null
  ): void {
    const target = parent === null ?
      this.#scene :
      requireThreeNode(parent).object3D;
    target.add(this.root);
  }

  seat(
    socket: Readonly<Mat4> | null
  ): void {
    if (socket === null) {
      this.#unseat();

      return;
    }

    if (this.#socket === null) {
      this.#socket = new THREE.Group();
      this.object3D.parent?.add(this.#socket);
      this.#socket.add(this.object3D);
    }
    kSocketMatrix.fromArray(socket).decompose(
      this.#socket.position,
      this.#socket.quaternion,
      this.#socket.scale
    );
    this.#socket.updateMatrixWorld(false);
  }

  rename(
    name: string
  ): void {
    this.object3D.name = name;
  }

  show(
    visible: boolean
  ): void {
    this.object3D.visible = visible;
  }

  enableLayer(
    layer: number
  ): void {
    this.object3D.layers.enable(layer);
    this.#scene.layers.enable(layer);
  }

  place(
    position: Readonly<Vec3>,
    quaternion: Readonly<Quat>,
    scale: Readonly<Vec3>
  ): void {
    const current = this.object3D.quaternion;
    this.object3D.position.fromArray(position);
    if (
      current.x !== quaternion[0] ||
      current.y !== quaternion[1] ||
      current.z !== quaternion[2] ||
      current.w !== quaternion[3]
    ) {
      current.fromArray(quaternion);
    }
    this.object3D.scale.fromArray(scale);
    this.object3D.updateMatrixWorld(false);
  }

  dispose(): void {
    disposeObject3D(
      this.object3D,
      { stopAtActors: true }
    );
    this.#socket?.removeFromParent();
    this.#socket = null;
  }

  #unseat(): void {
    const socket = this.#socket;
    if (socket === null) {
      return;
    }

    if (socket.parent === null) {
      this.object3D.removeFromParent();
    }
    else {
      socket.parent.add(this.object3D);
    }
    socket.removeFromParent();
    this.#socket = null;
  }
}

export class ThreeSceneGraph implements Systems.SceneGraph {
  readonly scene: THREE.Scene;
  postProcessing: PostProcessing | null = null;
  environment: Readonly<Systems.EnvironmentFile> | null = null;

  constructor(
    scene: THREE.Scene = new THREE.Scene()
  ) {
    this.scene = scene;
  }

  createNode(
    actor: Actor<any>
  ): ThreeActorNode {
    return new ThreeActorNode(actor, this.scene);
  }

  createEnvironment(
    world: Systems.World<any, any>
  ): Systems.SceneEnvironment {
    return new ThreeSceneEnvironment(this, world);
  }

  createAudio(): GlobalAudio {
    return new GlobalAudio();
  }

  prune(
    survivors: Iterable<Systems.ActorNode>
  ): void {
    const kept = new Set<THREE.Object3D>();
    for (const node of survivors) {
      kept.add(requireThreeNode(node).root);
    }
    for (const object of [...this.scene.children]) {
      if (!kept.has(object)) {
        this.scene.remove(object);
      }
    }
  }
}

export function findActor(
  object: THREE.Object3D | null
): Actor<any> | null {
  let current = object;
  while (current !== null) {
    const actor = kActors.get(current);
    if (actor !== undefined) {
      return actor;
    }
    current = current.parent;
  }

  return null;
}

function requireThreeNode(
  node: Systems.ActorNode
): ThreeActorNode {
  if (node instanceof ThreeActorNode) {
    return node;
  }

  throw new Error("The actor node is not a ThreeActorNode.");
}

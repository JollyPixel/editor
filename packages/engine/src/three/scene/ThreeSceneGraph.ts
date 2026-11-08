// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Actor } from "../../core/actor/Actor.ts";
import type {
  Matrix4,
  Quaternion,
  Vector3
} from "../../core/math.ts";
import type { World } from "../../core/systems/World.ts";
import type {
  ActorNode,
  SceneEnvironment,
  SceneGraph
} from "../../core/systems/scene/SceneGraph.ts";
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import type { ThreeRenderComponent } from "../rendering/ThreeRenderComponent.ts";
import { disposeObject3D } from "../utils/disposeObject3D.ts";
import { ThreeSceneEnvironment } from "./ThreeSceneEnvironment.ts";

declare module "../../core/systems/SceneBackend.ts" {
  interface SceneBackend {
    node: ThreeActorNode;
    graph: ThreeSceneGraph;
    audio: GlobalAudio;
    renderComponent: ThreeRenderComponent;
  }
}

// CONSTANTS
const kActors = new WeakMap<THREE.Object3D, Actor<any>>();

export class ThreeActorNode implements ActorNode {
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
    parent: ActorNode | null
  ): void {
    const target = parent === null ?
      this.#scene :
      requireThreeNode(parent).object3D;
    target.add(this.root);
  }

  seat(
    socket: Readonly<Matrix4> | null
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
    socket.decompose(
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
    position: Readonly<Vector3>,
    quaternion: Readonly<Quaternion>,
    scale: Readonly<Vector3>
  ): void {
    this.object3D.position.copy(position);
    if (!this.object3D.quaternion.equals(quaternion)) {
      this.object3D.quaternion.copy(quaternion);
    }
    this.object3D.scale.copy(scale);
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

export class ThreeSceneGraph implements SceneGraph {
  readonly scene: THREE.Scene;

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
    world: World<any, any>
  ): SceneEnvironment {
    return new ThreeSceneEnvironment(this.scene, world);
  }

  createAudio(): GlobalAudio {
    return new GlobalAudio();
  }

  prune(
    survivors: Iterable<ActorNode>
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
  node: ActorNode
): ThreeActorNode {
  if (node instanceof ThreeActorNode) {
    return node;
  }

  throw new Error("The actor node is not a ThreeActorNode.");
}

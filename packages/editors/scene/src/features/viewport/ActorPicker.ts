// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  InputCombination,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { visibleInWorld } from "../../scene/visibleInWorld.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";

// CONSTANTS
const kClickTolerance = 0.01;

export interface ActorResolver {
  findActorId(object: THREE.Object3D): string | null;
}

export interface ActorPickerOptions {
  camera: () => THREE.Camera;
  targets: ActorResolver;
  selection: SelectionStore;
  busy: () => boolean;
}

export class ActorPicker extends ActorComponent {
  #options: ActorPickerOptions;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #pressedAt: THREE.Vector2 | null = null;

  constructor(
    actor: Actor,
    options: ActorPickerOptions
  ) {
    super({
      actor,
      typeName: "ActorPicker"
    });
    this.#options = options;
    this.#raycaster.params.Line.threshold = 0.05;
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;

    if (mouse.wasJustPressed("left")) {
      this.#pressedAt = this.#options.busy() || InputCombination.Alt.evaluate(input) ?
        null :
        mouse.viewportPositionTo(new THREE.Vector2());
    }
    if (!mouse.wasJustReleased("left") || this.#pressedAt === null) {
      return;
    }

    const pressedAt = this.#pressedAt;
    this.#pressedAt = null;
    mouse.viewportPositionTo(this.#pointer);
    if (pressedAt.distanceTo(this.#pointer) > kClickTolerance) {
      return;
    }

    const id = this.pick(this.#pointer);
    const { selection } = this.#options;
    if (!InputCombination.Control.evaluate(input)) {
      selection.select(id === null ? [] : [id]);
    }
    else if (id !== null) {
      selection.toggle(id);
    }
  }

  pick(
    pointer: THREE.Vector2Like
  ): string | null {
    const scene = this.actor.world.sceneManager.getSource();
    this.#raycaster.setFromCamera(
      this.#pointer.set(pointer.x, pointer.y),
      this.#options.camera()
    );

    for (const hit of this.#raycaster.intersectObjects(scene.children, true)) {
      const id = visibleInWorld(hit.object) ?
        this.#options.targets.findActorId(hit.object) :
        null;
      if (id !== null) {
        return id;
      }
    }

    return null;
  }
}

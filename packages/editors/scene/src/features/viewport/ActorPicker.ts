// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  InputCombination,
  isVisibleInHierarchy,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  ActorAnchor,
  AnchorPicks
} from "../../state/AnchorPicks.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";

// CONSTANTS
const kClickTravel = 4;

export interface ActorResolver {
  findActorId(object: THREE.Object3D): string | null;
}

export interface AnchorResolver {
  pick(ray: THREE.Ray): ActorAnchor | null;
}

export interface ActorPickerOptions {
  camera: () => THREE.Camera;
  targets: ActorResolver;
  anchors: AnchorResolver;
  anchorPicks: AnchorPicks;
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
        mouse.positionTo(new THREE.Vector2());
    }
    if (!mouse.wasJustReleased("left") || this.#pressedAt === null) {
      return;
    }

    const pressedAt = this.#pressedAt;
    this.#pressedAt = null;
    if (pressedAt.distanceTo(mouse.positionTo(this.#pointer)) > kClickTravel) {
      return;
    }

    const aimed = this.#raycaster;
    aimed.setFromCamera(
      mouse.viewportPositionTo(this.#pointer),
      this.#options.camera()
    );
    const anchor = this.#options.anchors.pick(aimed.ray);
    if (anchor !== null) {
      this.#options.anchorPicks.emit("pick", anchor);

      return;
    }

    const id = this.#pickActor(aimed);
    const { selection } = this.#options;
    if (!InputCombination.Control.evaluate(input)) {
      selection.select(id === null ? [] : [id]);
    }
    else if (id !== null) {
      selection.toggle(id);
    }
  }

  #pickActor(
    aimed: THREE.Raycaster
  ): string | null {
    const scene = this.actor.world.sceneManager.getSource();
    for (const hit of aimed.intersectObjects(scene.children, true)) {
      const id = isVisibleInHierarchy(hit.object) ?
        this.#options.targets.findActorId(hit.object) :
        null;
      if (id !== null) {
        return id;
      }
    }

    return null;
  }
}

// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  InputCombination,
  type Actor,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  ActorAnchor,
  AnchorPicks
} from "../../state/AnchorPicks.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import {
  castActor,
  pivotPoint,
  type ActorResolver
} from "./actorHit.ts";

// CONSTANTS
const kClickTravel = 4;

export interface AnchorResolver {
  pick(ray: THREE.Ray): ActorAnchor | null;
}

export interface ViewportClickOptions {
  camera: Pick<OrbitFlyCamera, "camera" | "enterOrbitFocus">;
  targets: ActorResolver;
  anchors: AnchorResolver;
  anchorPicks: AnchorPicks;
  selection: SelectionStore;
  busy: () => boolean;
}

export class ViewportClick extends ActorComponent {
  #options: ViewportClickOptions;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #pressedAt: THREE.Vector2 | null = null;

  constructor(
    actor: Actor,
    options: ViewportClickOptions
  ) {
    super({
      actor,
      typeName: "ViewportClick"
    });
    this.#options = options;
    this.#raycaster.params.Line.threshold = 0.05;
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;

    if (mouse.wasJustPressed("left")) {
      this.#pressedAt = this.#options.busy() ?
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

    const { camera, targets } = this.#options;
    const scene = this.actor.world.sceneManager.getSource();
    const aimed = this.#raycaster;
    aimed.setFromCamera(mouse.viewportPositionTo(this.#pointer), camera.camera);
    if (InputCombination.Alt.evaluate(input)) {
      camera.enterOrbitFocus(pivotPoint(aimed, scene, targets));

      return;
    }

    const anchor = this.#options.anchors.pick(aimed.ray);
    if (anchor !== null) {
      this.#options.anchorPicks.emit("pick", anchor);

      return;
    }

    const id = castActor(aimed, scene, targets)?.id ?? null;
    const { selection } = this.#options;
    if (!InputCombination.Control.evaluate(input)) {
      selection.select(id === null ? [] : [id]);
    }
    else if (id !== null) {
      selection.toggle(id);
    }
  }
}

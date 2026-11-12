// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  InputCombination,
  type Actor,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";
import type { InputDevices } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type {
  ActorAnchor,
  AnchorPicks
} from "../../state/AnchorPicks.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import type { ActorMover } from "./ActorMover.ts";
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
  mover: Pick<ActorMover, "dragging" | "begin" | "move" | "end" | "cancel">;
  busy: () => boolean;
}

interface Press {
  at: THREE.Vector2;
  grab: THREE.Ray | null;
}

export class ViewportClick extends ActorComponent {
  #options: ViewportClickOptions;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #press: Press | null = null;

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
    const { mouse } = this.actor.world.input;
    if (this.#options.mover.dragging) {
      this.#drag();

      return;
    }
    if (mouse.wasJustPressed("left")) {
      this.#press = this.#options.busy() ? null : this.#pressed();
    }

    const press = this.#press;
    if (press === null) {
      return;
    }
    if (press.at.distanceTo(mouse.positionTo(this.#pointer)) > kClickTravel) {
      this.#travel(press);
    }
    else if (mouse.wasJustReleased("left")) {
      this.#press = null;
      this.#click();
    }
  }

  #pressed(): Press {
    const { input } = this.actor.world;

    return {
      at: input.mouse.positionTo(new THREE.Vector2()),
      grab: InputCombination.Alt.evaluate(input) ?
        null :
        this.#aim().ray.clone()
    };
  }

  #travel(
    press: Press
  ): void {
    const { input } = this.actor.world;
    if (!input.mouse.isDown("left")) {
      this.#press = null;

      return;
    }

    const grab = press.grab;
    press.grab = null;
    if (grab === null) {
      return;
    }

    this.#raycaster.ray.copy(grab);
    const plane = isLifting(input) ? "vertical" : "ground";
    if (this.#options.mover.begin(this.#raycaster, plane)) {
      this.#press = null;
      this.#drag();
    }
  }

  #click(): void {
    const { input } = this.actor.world;
    const { camera, targets, selection } = this.#options;
    const scene = this.actor.world.sceneManager.graph.scene;
    const aimed = this.#aim();
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
    if (!InputCombination.Control.evaluate(input)) {
      selection.select(id === null ? [] : [id]);
    }
    else if (id !== null) {
      selection.toggle(id);
    }
  }

  #drag(): void {
    const { input } = this.actor.world;
    const { mover } = this.#options;
    if (input.keyboard.wasJustPressed("Escape")) {
      mover.cancel();
    }
    else if (input.mouse.isDown("left")) {
      mover.move(this.#aim(), {
        rest: InputCombination.Shift.evaluate(input),
        free: InputCombination.Alt.evaluate(input)
      });
    }
    else {
      mover.end();
    }
  }

  #aim(): THREE.Raycaster {
    const { mouse } = this.actor.world.input;
    this.#raycaster.setFromCamera(
      mouse.viewportPositionTo(this.#pointer),
      this.#options.camera.camera
    );

    return this.#raycaster;
  }
}

function isLifting(
  input: InputDevices
): boolean {
  return InputCombination.Control.evaluate(input) ||
    InputCombination.Meta.evaluate(input);
}

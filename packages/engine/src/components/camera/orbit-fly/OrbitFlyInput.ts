// Import Third-party Dependencies
import {
  Axis,
  AxisMap,
  InputCombination,
  type InputCondition
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import type { OrbitFlyKeys } from "./OrbitFlyKeys.ts";
import type { OrbitFlyNudge } from "./CameraFocus.ts";
import type { FlyIntent } from "./FlyRig.ts";

// CONSTANTS
const kNudges: readonly OrbitFlyNudge[] = [
  "forward",
  "back",
  "right",
  "left",
  "up",
  "down"
];
const kStill = Object.freeze({ x: 0, y: 0 });

export type OrbitFlyDevices = Actor["world"]["input"];

type OrbitFlyAxis =
  | "moveRight"
  | "moveUp"
  | "moveForward"
  | "lookRight"
  | "lookUp";

export class OrbitFlyInput {
  #keys: OrbitFlyKeys;
  #axes: AxisMap<OrbitFlyAxis>;
  #descendBlocked = false;
  #scroll = { x: 0, y: 0 };
  #intent: FlyIntent = {
    move: { right: 0, up: 0, forward: 0 },
    look: { right: 0, up: 0 },
    drag: { x: 0, y: 0 },
    swipe: null,
    wheel: 0,
    nudge: null
  };

  #descend: InputCondition = {
    evaluate: (input) => !this.#descendBlocked &&
      this.#keys.held("down").evaluate(input),
    reset: () => void 0
  };

  constructor(
    keys: OrbitFlyKeys
  ) {
    this.#keys = keys;
    this.#axes = this.#bindAxes();
  }

  get keys(): OrbitFlyKeys {
    return this.#keys;
  }

  set keys(
    keys: OrbitFlyKeys
  ) {
    this.#keys = keys;
    this.#axes = this.#bindAxes();
  }

  suspend(
    input: OrbitFlyDevices
  ): void {
    this.#descendBlocked = this.#keys.held("down").evaluate(input);
  }

  read(
    input: OrbitFlyDevices
  ): Readonly<FlyIntent> {
    if (!this.#keys.held("down").evaluate(input)) {
      this.#descendBlocked = false;
    }

    const isCtrl = InputCombination.Control.evaluate(input);
    const scroll = input.mouse.scrollTo(this.#scroll);
    const isSwiping = !isCtrl && input.mouse.scrollSource === "touchpad";
    const isDragging = input.mouse.isDown("middle") ||
      (InputCombination.Alt.evaluate(input) && input.mouse.isDown("left"));

    this.#axes.update(input);

    const intent = this.#intent;
    intent.move.right = this.#axes.value("moveRight");
    intent.move.up = this.#axes.value("moveUp");
    intent.move.forward = this.#axes.value("moveForward");
    intent.look.right = this.#axes.value("lookRight");
    intent.look.up = this.#axes.value("lookUp");
    intent.drag = isDragging && input.mouse.isMoving() ?
      input.mouse.viewportDelta(false) :
      kStill;
    intent.swipe = isSwiping ? scroll : null;
    intent.wheel = isCtrl || isSwiping ? 0 : scroll.y;
    intent.nudge = kNudges.find(
      (action) => this.#keys.held(action).pressed.evaluate(input)
    ) ?? null;

    return intent;
  }

  #bindAxes(): AxisMap<OrbitFlyAxis> {
    const keys = this.#keys;

    return new AxisMap({
      moveRight: Axis.buttons(keys.held("right"), keys.held("left")),
      moveUp: Axis.buttons(keys.held("up"), this.#descend),
      moveForward: Axis.buttons(keys.held("forward"), keys.held("back")),
      lookRight: Axis.buttons(keys.held("lookRight"), keys.held("lookLeft")),
      lookUp: Axis.buttons(keys.held("lookUp"), keys.held("lookDown"))
    });
  }
}

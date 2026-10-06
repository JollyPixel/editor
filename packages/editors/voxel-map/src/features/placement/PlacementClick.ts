// Import Third-party Dependencies
import { InputCombination } from "@jolly-pixel/controls";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { PointerCapture } from "../../state/index.ts";
import type { MapPlacement } from "./MapPlacement.ts";

export interface PlacementClickOptions {
  placement: Pick<MapPlacement, "placing" | "commit">;
  pointer: Pick<PointerCapture, "captured">;
}

export class PlacementClick extends ActorComponent {
  #placement: PlacementClickOptions["placement"];
  #pointerCapture: PlacementClickOptions["pointer"];

  constructor(
    actor: Actor,
    options: PlacementClickOptions
  ) {
    super({
      actor,
      typeName: "PlacementClick"
    });
    this.#placement = options.placement;
    this.#pointerCapture = options.pointer;
  }

  update(): void {
    if (this.#placement.placing && this.#pressedOutside()) {
      this.#placement.commit();
    }
  }

  #pressedOutside(): boolean {
    const { input } = this.actor.world;

    return input.mouse.hovering &&
      input.mouse.wasJustPressed("left") &&
      !this.#pointerCapture.captured &&
      !InputCombination.Alt.evaluate(input) &&
      !InputCombination.Control.evaluate(input);
  }
}

// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { Mode } from "../../types.ts";

/**
 * Enables primary-button panning without activating a drawing tool.
 */
export class MoveMode extends InteractionMode {
  readonly id: Mode = "move";

  cursor(): string {
    return "grab";
  }
}

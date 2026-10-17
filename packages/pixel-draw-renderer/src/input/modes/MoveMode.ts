// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { Mode } from "../../types.ts";

export class MoveMode extends InteractionMode {
  readonly id: Mode = "move";
  readonly pansOnPrimary = true;

  cursor(): string {
    return "grab";
  }
}

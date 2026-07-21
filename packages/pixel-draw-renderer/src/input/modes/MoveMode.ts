// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { Mode } from "../../types.ts";

/**
 * Navigation-only mode: no drawing tool is active. Pan (middle-drag) and zoom
 * (wheel) are mode-independent and handled by the viewport
 */
export class MoveMode extends InteractionMode {
  readonly id: Mode = "move";
}

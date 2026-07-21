// Import Internal Dependencies
import { InteractionMode } from "./InteractionMode.ts";
import type { Mode } from "../../types.ts";

/**
 * Navigation-only mode: no drawing tool is active. A one-finger left-drag pans
 * (wired via `PixelArtCanvas`'s `shouldPanOnPrimary`), on top of the
 * mode-independent middle-drag / Space+drag pan and wheel zoom. The `grab`
 * cursor advertises the drag-to-pan affordance.
 */
export class MoveMode extends InteractionMode {
  readonly id: Mode = "move";

  cursor(): string {
    return "grab";
  }
}

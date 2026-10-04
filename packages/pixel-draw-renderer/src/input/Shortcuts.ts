// Import Internal Dependencies
import type { CanvasShortcuts } from "./CanvasShortcuts.ts";
import type { InteractionRouter } from "./InteractionRouter.ts";
import type { ClipboardController } from "../clipboard/ClipboardController.ts";
import type { RotationDirection } from "../types.ts";

export interface ShortcutsOptions {
  router: InteractionRouter;
  clipboard: Pick<ClipboardController, "startCopy" | "startPaste">;
  history: {
    undo(): boolean;
    redo(): boolean;
  };
}

export class Shortcuts implements CanvasShortcuts {
  #router: InteractionRouter;
  #clipboard: ShortcutsOptions["clipboard"];
  #history: ShortcutsOptions["history"];

  constructor(
    options: ShortcutsOptions
  ) {
    this.#router = options.router;
    this.#clipboard = options.clipboard;
    this.#history = options.history;
  }

  get panHeld(): boolean {
    return this.#router.panHeld;
  }

  set panHeld(
    held: boolean
  ) {
    this.#router.panHeld = held;
  }

  get lineHeld(): boolean {
    return this.#router.lineHeld;
  }

  set lineHeld(
    held: boolean
  ) {
    this.#router.lineHeld = held;
  }

  copy(): boolean {
    return this.#clipboard.startCopy();
  }

  paste(): boolean {
    return this.#clipboard.startPaste();
  }

  delete(): boolean {
    return this.#router.delete();
  }

  undo(): boolean {
    return this.#history.undo();
  }

  redo(): boolean {
    return this.#history.redo();
  }

  rotate(
    direction: RotationDirection
  ): boolean {
    return this.#router.rotate(direction);
  }

  flipHorizontal(): boolean {
    return this.#router.flipHorizontal();
  }

  flipVertical(): boolean {
    return this.#router.flipVertical();
  }
}

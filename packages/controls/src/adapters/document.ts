// Import Internal Dependencies
import type {
  EventTargetAdapter,
  EventTargetListener
} from "./eventTarget.ts";

export interface DocumentAdapter extends EventTargetAdapter {
  /**
   * Typed `unknown` rather than `Element | null`: callers only ever compare
   * this by identity against a `CanvasAdapter`, which doesn't (and shouldn't)
   * structurally resemble a DOM `Element`.
   */
  readonly fullscreenElement?: unknown;
  readonly pointerLockElement?: unknown;

  exitFullscreen(): void;
  exitPointerLock(): void;
}

export class BrowserDocumentAdapter implements DocumentAdapter {
  get fullscreenElement(): Element | null {
    return document.fullscreenElement;
  }

  get pointerLockElement(): Element | null {
    return document.pointerLockElement;
  }

  addEventListener(
    type: string,
    listener: EventTargetListener
  ) {
    document.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: EventTargetListener
  ) {
    document.removeEventListener(type, listener);
  }

  exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
}

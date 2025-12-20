// Import Internal Dependencies
import type {
  EventTargetAdapter,
  EventTargetListener
} from "./eventTarget.ts";

export interface DocumentAdapter extends EventTargetAdapter {
  fullscreenElement?: Element | null;
  pointerLockElement?: Element | null;

  exitFullscreen(): void;
  exitPointerLock(): void;
}

export class BrowserDocumentAdapter implements DocumentAdapter {
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

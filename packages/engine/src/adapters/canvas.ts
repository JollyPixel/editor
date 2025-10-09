// Import Internal Dependencies
import type { EventTargetAdapter } from "./eventTarget.js";

export interface CanvasAdapter extends EventTargetAdapter {
  requestFullscreen(): void;
  requestPointerLock(options?: PointerLockOptions | undefined): Promise<void>;
  focus(options?: FocusOptions | undefined): void;
}

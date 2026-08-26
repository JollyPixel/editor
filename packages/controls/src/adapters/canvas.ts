// Import Internal Dependencies
import type { EventTargetAdapter } from "./eventTarget.ts";

export interface CanvasAdapter extends EventTargetAdapter {
  requestFullscreen(): void;
  requestPointerLock(
    options?: PointerLockOptions | undefined,
  ): Promise<void>;
  focus(
    options?: FocusOptions | undefined,
  ): void;

  getBoundingClientRect?(): {
    left: number;
    top: number;
  };

  readonly clientWidth: number;
  readonly clientHeight: number;
  style: {
    cursor: string;
  };
}

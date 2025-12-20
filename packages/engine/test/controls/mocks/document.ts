// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.ts";

export class DocumentAdapter extends EventTargetAdapter {
  fullscreenElement: any = null;

  exitPointerLock = mock.fn();
  exitFullscreen = mock.fn();
  requestFullscreen = mock.fn();
}

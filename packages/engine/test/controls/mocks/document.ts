// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { EventTargetAdapter } from "./eventTarget.js";

export class DocumentAdapter extends EventTargetAdapter {
  fullscreenElement: any = null;

  exitPointerLock = mock.fn();
  exitFullscreen = mock.fn();
  requestFullscreen = mock.fn();
}

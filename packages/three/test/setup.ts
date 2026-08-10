// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { installCanvasMock } from "./fixtures/canvas.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

// PeerFrustum's optional nameplate uses `document.createElement("canvas")`.
// happy-dom has no 2D canvas context, so the emulated window is registered
// on globalThis once per test process (wired through `node --import ./test/setup.ts`).
Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement
});

installCanvasMock(document);

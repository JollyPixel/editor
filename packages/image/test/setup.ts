// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { installCanvasMock } from "./fixtures/canvas.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

// Only the raster suite loads this file (`test-only:dom`). The root entry's
// suite runs without it, so an accidental DOM reference in src/png fails
// there rather than at a consumer's build.
Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement,
  Image: kEmulatedBrowserWindow.Image
});

installCanvasMock(document);

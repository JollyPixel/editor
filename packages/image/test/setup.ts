// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { installCanvasMock } from "./fixtures/canvas.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement,
  Image: kEmulatedBrowserWindow.Image
});

installCanvasMock(document);

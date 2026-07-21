// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { installCanvasMock } from "./fixtures/canvas.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

// happy-dom has no layout engine and no 2D canvas context, so the emulated
// window is registered on globalThis once per test process (wired through
// `node --import ./test/setup.ts`). getComputedStyle returns a fixed
// background-color the PixelArtCanvas suite asserts against.
Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  HTMLElement: kEmulatedBrowserWindow.HTMLElement,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement,
  Event: kEmulatedBrowserWindow.Event,
  getComputedStyle: () => {
    return { backgroundColor: "#555555" };
  }
});

installCanvasMock(document);

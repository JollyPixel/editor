// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  installCanvasMock
} from "./fixtures/canvas.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  WheelEvent: kEmulatedBrowserWindow.WheelEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  HTMLElement: kEmulatedBrowserWindow.HTMLElement,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement,
  Event: kEmulatedBrowserWindow.Event,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  requestAnimationFrame: kEmulatedBrowserWindow.requestAnimationFrame.bind(kEmulatedBrowserWindow),
  cancelAnimationFrame: kEmulatedBrowserWindow.cancelAnimationFrame.bind(kEmulatedBrowserWindow),
  getComputedStyle: () => {
    return {
      backgroundColor: "#555555"
    };
  }
});

installCanvasMock(document);

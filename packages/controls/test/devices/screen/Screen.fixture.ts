// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Screen } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

export class ScreenDocumentAdapter extends mocks.DocumentAdapter {
  dispatchEvent(
    type: "fullscreenchange" | "fullscreenerror"
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.Event(type);

    listeners.forEach((listener) => listener(event));
  }
}

export interface ScreenFixture {
  fullscreen: Screen;
  canvas: mocks.CanvasAdapter;
  documentAdapter: ScreenDocumentAdapter;
}

export function createConnectedScreenFixture(): ScreenFixture {
  const canvas = new mocks.CanvasAdapter();
  const documentAdapter = new ScreenDocumentAdapter();
  const fullscreen = new Screen({
    canvas,
    documentAdapter
  });
  fullscreen.connect();

  return {
    fullscreen,
    canvas,
    documentAdapter
  };
}

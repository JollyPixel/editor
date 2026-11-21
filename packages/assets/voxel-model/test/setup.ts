// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

function createImageData(
  width: number,
  height: number
) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4)
  };
}

const kStub2dContext = {
  imageSmoothingEnabled: false,
  createImageData,
  putImageData: () => undefined,
  getImageData: (
    _x: number,
    _y: number,
    width: number,
    height: number
  ) => createImageData(width, height)
};

function stubGetContext(
  contextId: string
): typeof kStub2dContext | null {
  return contextId === "2d" ? kStub2dContext : null;
}

Object.assign(kEmulatedBrowserWindow.HTMLCanvasElement.prototype, {
  getContext: stubGetContext
});

Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement
});

// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

const kElementConstructors = Object.fromEntries(
  Object.keys(kEmulatedBrowserWindow)
    .filter((key) => key.startsWith("HTML") && key.endsWith("Element"))
    .map((key): [string, unknown] => [
      key,
      Reflect.get(kEmulatedBrowserWindow, key)
    ])
);

Object.assign(globalThis, {
  ...kElementConstructors,
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  Element: kEmulatedBrowserWindow.Element,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(kEmulatedBrowserWindow)
});

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
  beginPath: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  fillStyle: "",
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

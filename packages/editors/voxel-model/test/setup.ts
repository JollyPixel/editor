// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

const kElementConstructors = Object.fromEntries(
  Object.keys(kEmulatedBrowserWindow)
    .filter((key) => key.startsWith("HTML") && key.endsWith("Element"))
    .map((key) => [
      key,
      kEmulatedBrowserWindow[key as keyof Window]
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

const kStub2dContext = {
  beginPath: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  fillStyle: ""
};

function stubGetContext(
  contextId: string
): typeof kStub2dContext | null {
  return contextId === "2d" ? kStub2dContext : null;
}

kEmulatedBrowserWindow.HTMLCanvasElement.prototype.getContext =
  stubGetContext as typeof kEmulatedBrowserWindow.HTMLCanvasElement.prototype.getContext;

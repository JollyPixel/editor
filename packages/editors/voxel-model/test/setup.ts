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

/*
 * happy-dom has no browser to run in, so DOM-touching src/ code (instanceof
 * checks, document.createElement) needs these globals, wired through
 * `node --import ./test/setup.ts`.
 */
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

/*
 * happy-dom's canvas has no real 2D backend (getContext("2d") returns
 * null), but PivotMarker draws a circle texture on one at construction
 * time, so any test that builds a GroupManager needs a stub context.
 */
function noop(): void {
  // Intentionally does nothing, the drawing itself is untested.
}

const kStub2dContext = {
  beginPath: noop,
  arc: noop,
  fill: noop,
  fillStyle: ""
};

function stubGetContext(
  contextId: string
): typeof kStub2dContext | null {
  return contextId === "2d" ? kStub2dContext : null;
}

kEmulatedBrowserWindow.HTMLCanvasElement.prototype.getContext =
  stubGetContext as typeof kEmulatedBrowserWindow.HTMLCanvasElement.prototype.getContext;

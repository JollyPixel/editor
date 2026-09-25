// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

const kCanvas2DStub = new Proxy({}, {
  get(target: Record<string, unknown>, property: string) {
    if (!(property in target)) {
      target[property] = () => void 0;
    }

    return target[property];
  },
  set(
    target: Record<string, unknown>,
    property: string,
    value: unknown
  ) {
    target[property] = value;

    return true;
  }
});

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
  localStorage: kEmulatedBrowserWindow.localStorage,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent
});

Object.assign(kEmulatedBrowserWindow.HTMLCanvasElement.prototype, {
  getContext: (contextId: string) => (contextId === "2d" ? kCanvas2DStub : null)
});

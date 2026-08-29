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
  set(target: Record<string, unknown>, property: string, value: unknown) {
    target[property] = value;

    return true;
  }
});

Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  HTMLElement: kEmulatedBrowserWindow.HTMLElement,
  HTMLCanvasElement: kEmulatedBrowserWindow.HTMLCanvasElement,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent
});

Object.assign(kEmulatedBrowserWindow.HTMLCanvasElement.prototype, {
  getContext: (
    contextId: string
  ) => (contextId === "2d" ? kCanvas2DStub : null)
});

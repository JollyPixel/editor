// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

const globals: Record<string, unknown> = {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  customElements: kEmulatedBrowserWindow.customElements,
  requestAnimationFrame: kEmulatedBrowserWindow.requestAnimationFrame.bind(
    kEmulatedBrowserWindow
  ),
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(
    kEmulatedBrowserWindow
  )
};
for (const name of Object.getOwnPropertyNames(kEmulatedBrowserWindow)) {
  if (/^[A-Z]/.test(name) && !(name in globalThis)) {
    globals[name] = Reflect.get(kEmulatedBrowserWindow, name);
  }
}
Object.assign(globalThis, globals);

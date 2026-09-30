// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
const kElementConstructors = Object.fromEntries(
  Object.keys(kEmulatedBrowserWindow)
    .filter((key) => /^HTML\w*Element$/.test(key))
    .map((key) => [
      key,
      Reflect.get(kEmulatedBrowserWindow, key)
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

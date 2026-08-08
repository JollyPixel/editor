// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

// happy-dom has no browser to run in, so DOM-touching src/ code (instanceof
// checks, document.createElement) needs these globals, wired through
// `node --import ./test/setup.ts`.
Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  Element: kEmulatedBrowserWindow.Element,
  HTMLElement: kEmulatedBrowserWindow.HTMLElement,
  HTMLInputElement: kEmulatedBrowserWindow.HTMLInputElement,
  HTMLDivElement: kEmulatedBrowserWindow.HTMLDivElement,
  HTMLButtonElement: kEmulatedBrowserWindow.HTMLButtonElement,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(kEmulatedBrowserWindow)
});

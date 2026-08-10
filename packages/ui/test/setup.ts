// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

/**
 * DOM globals for happy-dom, wired through `node --import ./test/setup.ts`.
 *
 * `Document`, `ShadowRoot`, `CSSStyleSheet` and `HTMLTemplateElement` are for Lit, not for any
 * test: `@lit/reactive-element/node/css-tag.js` reads `Document.prototype` at import time, so
 * importing `lit` fails with `Document is not defined` before a test runs. A partial set fails
 * the same obscure way, hence all of them.
 */
Object.assign(globalThis, {
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  Document: kEmulatedBrowserWindow.Document,
  ShadowRoot: kEmulatedBrowserWindow.ShadowRoot,
  CSSStyleSheet: kEmulatedBrowserWindow.CSSStyleSheet,
  HTMLTemplateElement: kEmulatedBrowserWindow.HTMLTemplateElement,
  Element: kEmulatedBrowserWindow.Element,
  HTMLElement: kEmulatedBrowserWindow.HTMLElement,
  HTMLInputElement: kEmulatedBrowserWindow.HTMLInputElement,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  localStorage: kEmulatedBrowserWindow.localStorage,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(
    kEmulatedBrowserWindow
  )
});

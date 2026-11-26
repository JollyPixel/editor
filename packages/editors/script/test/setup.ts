// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window({
  url: "http://localhost/"
});
const kDomGlobals = new Set([
  "CSSStyleSheet",
  "Document",
  "DocumentFragment",
  "DOMParser",
  "Element",
  "MutationObserver",
  "Node",
  "NodeFilter",
  "ResizeObserver",
  "ShadowRoot",
  "Text",
  "TreeWalker"
]);
const kDomConstructors = Object.fromEntries(
  Object.keys(kEmulatedBrowserWindow)
    .filter((key) => kDomGlobals.has(key) || /^HTML\w*Element$/.test(key))
    .map((key) => [
      key,
      Reflect.get(kEmulatedBrowserWindow, key)
    ])
);

Object.assign(globalThis, {
  ...kDomConstructors,
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  customElements: kEmulatedBrowserWindow.customElements,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  InputEvent: kEmulatedBrowserWindow.InputEvent,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(
    kEmulatedBrowserWindow
  ),
  requestAnimationFrame: kEmulatedBrowserWindow.requestAnimationFrame.bind(
    kEmulatedBrowserWindow
  ),
  cancelAnimationFrame: kEmulatedBrowserWindow.cancelAnimationFrame.bind(
    kEmulatedBrowserWindow
  )
});

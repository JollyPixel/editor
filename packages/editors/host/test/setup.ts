// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window({
  url: "http://localhost/"
});
const kDomGlobals = new Set([
  "Comment",
  "CSSStyleSheet",
  "Document",
  "DocumentFragment",
  "DOMParser",
  "Element",
  "IntersectionObserver",
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
  location: kEmulatedBrowserWindow.location,
  sessionStorage: kEmulatedBrowserWindow.sessionStorage,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  MessageEvent: kEmulatedBrowserWindow.MessageEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  MouseEvent: kEmulatedBrowserWindow.MouseEvent,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(
    kEmulatedBrowserWindow
  )
});

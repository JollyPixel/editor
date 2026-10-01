// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kEmulatedBrowserWindow = new Window({
  url: "http://localhost/editor/"
});

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
  HTMLButtonElement: kEmulatedBrowserWindow.HTMLButtonElement,
  Event: kEmulatedBrowserWindow.Event,
  CustomEvent: kEmulatedBrowserWindow.CustomEvent,
  EventTarget: kEmulatedBrowserWindow.EventTarget,
  KeyboardEvent: kEmulatedBrowserWindow.KeyboardEvent,
  PointerEvent: kEmulatedBrowserWindow.PointerEvent,
  MutationObserver: kEmulatedBrowserWindow.MutationObserver,
  localStorage: kEmulatedBrowserWindow.localStorage,
  location: kEmulatedBrowserWindow.location,
  getComputedStyle: kEmulatedBrowserWindow.getComputedStyle.bind(
    kEmulatedBrowserWindow
  )
});

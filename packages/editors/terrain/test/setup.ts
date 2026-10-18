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

Object.assign(globalThis, {
  ...kElementConstructors,
  window: kEmulatedBrowserWindow,
  document: kEmulatedBrowserWindow.document,
  localStorage: kEmulatedBrowserWindow.localStorage
});

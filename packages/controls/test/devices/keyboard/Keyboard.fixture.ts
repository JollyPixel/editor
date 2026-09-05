// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  Keyboard,
  type KeyCode
} from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

export interface EventData {
  code?: KeyCode;
  key?: string;
  /** Stands in for the composed path, which an undispatched event cannot supply. */
  target?: unknown;
}

export class KeyboardDocumentAdapter extends mocks.DocumentAdapter {
  dispatchEvent(
    type: "keydown" | "keypress" | "keyup",
    eventData: EventData
  ) {
    const event = new kEmulatedBrowserWindow.KeyboardEvent(type, {
      code: eventData.code || "",
      key: eventData.key || "",
      bubbles: true,
      cancelable: true
    });

    if ("target" in eventData) {
      Object.defineProperty(event, "composedPath", {
        value: () => [eventData.target]
      });
    }

    const listeners = this.listeners.get(type) ?? [];
    listeners.forEach((listener) => listener(event));

    return event;
  }
}

export interface KeyboardFixture {
  keyboard: Keyboard;
  documentAdapter: KeyboardDocumentAdapter;
}

export function createConnectedKeyboardFixture(): KeyboardFixture {
  const documentAdapter = new KeyboardDocumentAdapter();
  const keyboard = new Keyboard({
    documentAdapter
  });
  keyboard.connect();

  return {
    keyboard,
    documentAdapter
  };
}

export function createElement(
  tagName: string
) {
  return kEmulatedBrowserWindow.document.createElement(tagName);
}

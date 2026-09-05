// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Mouse } from "../../src/index.ts";
import { CanvasAdapter } from "../mocks/canvas.ts";
import { DocumentAdapter } from "../mocks/document.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

export interface MouseEventData {
  button?: number;
  clientX?: number;
  clientY?: number;
  movementX?: number;
  movementY?: number;
  /** Simulates an environment that does not expose offsetX/offsetY. */
  omitOffsets?: boolean;
}

export interface WheelEventData {
  wheelDelta?: number;
  wheelDeltaX?: number;
  wheelDeltaY?: number;
  detail?: number;
}

export class MouseCanvasAdapter extends CanvasAdapter {
  rect = { left: 0, top: 0 };
  pointerLockElement: any = null;
  boundingClientRectCalls = 0;

  getBoundingClientRect() {
    this.boundingClientRectCalls++;

    return this.rect;
  }

  dispatchMouseEvent(
    type: "mousedown" | "mouseup" | "mousemove" | "dblclick",
    eventData: MouseEventData = {}
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.MouseEvent(type, {
      button: eventData.button ?? 0,
      clientX: eventData.clientX ?? 0,
      clientY: eventData.clientY ?? 0,
      movementX: eventData.movementX ?? 0,
      movementY: eventData.movementY ?? 0,
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, "target", {
      value: this,
      writable: false
    });

    // Browsers expose offsets relative to the target's box. The fallback
    // covers environments where these properties are unavailable.
    Object.defineProperty(event, "offsetX", {
      value: eventData.omitOffsets ?
        undefined :
        (eventData.clientX ?? 0) - this.rect.left,
      writable: false
    });
    Object.defineProperty(event, "offsetY", {
      value: eventData.omitOffsets ?
        undefined :
        (eventData.clientY ?? 0) - this.rect.top,
      writable: false
    });

    listeners.forEach((listener) => listener(event));

    return event;
  }

  dispatchWheelEvent(
    eventData: WheelEventData = {}
  ) {
    const listeners = this.listeners.get("wheel") ?? new Set();
    const event = new kEmulatedBrowserWindow.WheelEvent("wheel", {
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, "wheelDelta", {
      value: eventData.wheelDelta ?? 0,
      writable: false
    });
    Object.defineProperty(event, "wheelDeltaX", {
      value: eventData.wheelDeltaX ?? 0,
      writable: false
    });
    Object.defineProperty(event, "wheelDeltaY", {
      value: eventData.wheelDeltaY ?? eventData.wheelDelta ?? 0,
      writable: false
    });
    Object.defineProperty(event, "detail", {
      value: eventData.detail ?? 0,
      writable: false
    });

    listeners.forEach((listener) => listener(event));
  }
}

export class MouseDocumentAdapter extends DocumentAdapter {
  override exitPointerLock = mock.fn();
  override pointerLockElement: any = null;

  /** A move or release that happened away from the canvas. */
  dispatchMouseEvent(
    type: "mousemove" | "mouseup",
    eventData: MouseEventData = {}
  ) {
    const event = new kEmulatedBrowserWindow.MouseEvent(type, {
      button: eventData.button ?? 0,
      clientX: eventData.clientX ?? 0,
      clientY: eventData.clientY ?? 0,
      bubbles: true,
      cancelable: true
    });

    this.replay(type, event);
  }

  /** Replays a canvas event the way bubbling delivers it to the document. */
  replay(
    type: string,
    event: unknown
  ) {
    const listeners = this.listeners.get(type) ?? new Set();

    listeners.forEach((listener) => listener(event as any));
  }

  dispatchEvent(
    type: "pointerlockchange" | "pointerlockerror"
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.Event(type);

    listeners.forEach((listener) => listener(event));
  }
}

export interface MouseFixture {
  mouse: Mouse;
  canvas: MouseCanvasAdapter;
  documentAdapter: MouseDocumentAdapter;
}

export function createConnectedMouseFixture(): MouseFixture {
  const canvas = new MouseCanvasAdapter();
  const documentAdapter = new MouseDocumentAdapter();
  const mouse = new Mouse({
    canvas,
    documentAdapter
  });
  mouse.connect();

  return {
    mouse,
    canvas,
    documentAdapter
  };
}

export function createTouch(
  identifier: number,
  clientX: number,
  clientY: number
): Touch {
  return {
    identifier,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    target: null as any
  } as Touch;
}

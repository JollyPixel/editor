// Import Node.js Dependencies
import { before, afterEach } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kWindow = new Window();

before(() => {
  const win = kWindow as unknown as Record<string, unknown>;

  globalThis.document = kWindow.document as unknown as Document;
  globalThis.HTMLDivElement = win.HTMLDivElement as typeof HTMLDivElement;
  globalThis.MouseEvent = win.MouseEvent as typeof MouseEvent;
  globalThis.PointerEvent = win.PointerEvent as typeof PointerEvent;
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove(
    "handle-dragging",
    "vertical",
    "horizontal"
  );
});

export function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.appendChild(div);

  return div;
}

export function makeTarget(
  container: HTMLElement,
  width = 200,
  height = 150
): HTMLElement {
  const div = document.createElement("div");
  container.appendChild(div);
  mockBoundingRect(div, width, height);

  return div;
}

export function mockBoundingRect(
  element: Element,
  width: number,
  height: number
): void {
  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height
  } as unknown as DOMRect);
}

/**
 * Installs setPointerCapture / releasePointerCapture stubs on an element.
 * Returns a state object so tests can assert the current capture state.
 */
export function installPointerCaptureMock(
  element: HTMLElement
): { captured: number | null; } {
  const state: { captured: number | null; } = {
    captured: null
  };
  element.setPointerCapture = (id: number) => {
    state.captured = id;
  };
  element.releasePointerCapture = () => {
    state.captured = null;
  };

  return state;
}

export function firePointerEvent(
  element: HTMLElement,
  type: string,
  init?: PointerEventInit
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    ...init
  });
  element.dispatchEvent(event);

  return event;
}

export function fireMouseEvent(
  element: HTMLElement,
  type: string,
  init?: MouseEventInit
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    ...init
  });
  element.dispatchEvent(event);

  return event;
}

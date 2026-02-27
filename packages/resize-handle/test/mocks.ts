// Import Node.js Dependencies
import { before, afterEach } from "node:test";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// CONSTANTS
const kWindow = new Window();

// Bootstrap global DOM once before all tests run
before(() => {
  const win = kWindow as unknown as Record<string, unknown>;

  globalThis.document = kWindow.document as unknown as Document;
  globalThis.HTMLDivElement = win.HTMLDivElement as typeof HTMLDivElement;
  globalThis.MouseEvent = win.MouseEvent as typeof MouseEvent;
  globalThis.PointerEvent = win.PointerEvent as typeof PointerEvent;
});

// Clean up the DOM between tests
afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove("handle-dragging", "vertical", "horizontal");
});

/** Appends a container div to document.body and returns it. */
export function makeContainer(): HTMLElement {
  const div = document.createElement("div") as unknown as HTMLElement;
  document.body.appendChild(div);

  return div;
}

/** Appends a target div to container with a mocked getBoundingClientRect. */
export function makeTarget(container: HTMLElement, width = 200, height = 150): HTMLElement {
  const div = document.createElement("div") as unknown as HTMLElement;
  container.appendChild(div);
  mockBoundingRect(div, width, height);

  return div;
}

/** Patches getBoundingClientRect on an element to return fixed dimensions. */
export function mockBoundingRect(elt: HTMLElement, width: number, height: number): void {
  (elt as unknown as Record<string, unknown>).getBoundingClientRect = () => {
    return {
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height
    };
  };
}

/**
 * Installs setPointerCapture / releasePointerCapture stubs on an element.
 * Returns a state object so tests can assert the current capture state.
 */
export function installPointerCaptureMock(elt: HTMLElement): { captured: number | null; } {
  const state: { captured: number | null; } = { captured: null };
  const record = elt as unknown as Record<string, unknown>;

  record.setPointerCapture = (id: number) => {
    state.captured = id;
  };
  record.releasePointerCapture = (_id: number) => {
    state.captured = null;
  };

  return state;
}

/** Dispatches a PointerEvent on an element and returns it. */
export function firePointerEvent(
  elt: HTMLElement,
  type: string,
  init?: PointerEventInit
): PointerEvent {
  const event = new PointerEvent(type, { bubbles: true, ...init });
  elt.dispatchEvent(event);

  return event;
}

/** Dispatches a MouseEvent on an element and returns it. */
export function fireMouseEvent(
  elt: HTMLElement,
  type: string,
  init?: MouseEventInit
): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, ...init });
  elt.dispatchEvent(event);

  return event;
}

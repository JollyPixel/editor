// DOM event factories/dispatchers shared across the input and canvas specs.
// The global event constructors are happy-dom's, registered in test/setup.ts.

export function shiftKeyDown(
  repeat = false
): KeyboardEvent {
  return new KeyboardEvent(
    "keydown",
    { key: "Shift", bubbles: true, repeat }
  );
}

export function shiftKeyUp(): KeyboardEvent {
  return new KeyboardEvent(
    "keyup",
    { key: "Shift", bubbles: true }
  );
}

export function spaceKeyDown(
  repeat = false
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: " ",
    code: "Space",
    bubbles: true,
    cancelable: true,
    repeat
  });
}

export function spaceKeyUp(): KeyboardEvent {
  return new KeyboardEvent("keyup", {
    key: " ",
    code: "Space",
    bubbles: true
  });
}

export interface WheelOptions {
  deltaY?: number;
  deltaMode?: number;
  ctrlKey?: boolean;
  clientX?: number;
  clientY?: number;
}

export function wheel(
  options: WheelOptions = {}
): WheelEvent {
  return new WheelEvent("wheel", {
    deltaY: options.deltaY ?? 0,
    deltaMode: options.deltaMode ?? 0,
    ctrlKey: options.ctrlKey ?? false,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    bubbles: true,
    cancelable: true
  });
}

export function moveTo(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): void {
  canvas.dispatchEvent(
    new MouseEvent("mousemove", {
      clientX,
      clientY,
      bubbles: true
    })
  );
}

export function hoverCanvas(
  canvas: HTMLCanvasElement
): void {
  canvas.dispatchEvent(
    new MouseEvent("mouseenter", {
      bubbles: true
    })
  );
}

/** A left-button mouse event (button 0 / buttons 1) at the given client point. */
export function mouseEvent(
  type: string,
  clientX: number,
  clientY: number
): MouseEvent {
  return new MouseEvent(type, {
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    bubbles: true
  });
}

export function deleteKey(): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "Delete",
    code: "Delete",
    bubbles: true,
    cancelable: true
  });
}

/** A Ctrl+<letter> keydown, with the physical code derived from the letter. */
export function ctrlKey(
  key: string
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
}

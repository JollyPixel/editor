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
  const event = new WheelEvent("wheel", {
    deltaY: options.deltaY ?? 0,
    deltaMode: options.deltaMode ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
    bubbles: true,
    cancelable: true
  });
  Object.defineProperty(event, "ctrlKey", {
    value: options.ctrlKey ?? false
  });

  return event;
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

export function stroke(
  canvas: HTMLCanvasElement,
  points: [number, number][],
  button: 0 | 2 = 0
): void {
  const [first, ...rest] = points;
  const buttons = button === 0 ? 1 : 2;
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button,
    buttons,
    clientX: first[0],
    clientY: first[1],
    bubbles: true
  }));
  for (const [clientX, clientY] of rest) {
    const event = new MouseEvent("mousemove", {
      button,
      buttons,
      clientX,
      clientY,
      bubbles: true
    });
    canvas.dispatchEvent(event);
  }
  canvas.dispatchEvent(
    new MouseEvent("mouseup", {
      button,
      bubbles: true
    })
  );
}

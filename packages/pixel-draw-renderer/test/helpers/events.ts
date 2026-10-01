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

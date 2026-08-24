/**
 * Returns a required element or throws immediately.
 */
export function requireElement<TElement extends Element>(
  selector: string
): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

/**
 * Returns the canvas 2D context or throws immediately.
 */
export function requireContext2d(
  canvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2d context unavailable");
  }

  return context;
}

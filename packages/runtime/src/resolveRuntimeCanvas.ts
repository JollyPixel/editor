export type RuntimeCanvasTarget = HTMLCanvasElement | string;

export function resolveRuntimeCanvas(
  target: RuntimeCanvasTarget
): HTMLCanvasElement {
  if (typeof target !== "string") {
    if (!(target instanceof HTMLCanvasElement)) {
      throw new Error(
        "An HTMLCanvasElement or a CSS selector is required to create " +
        "a Runtime instance."
      );
    }

    return target;
  }

  const element = document.querySelector(target);
  if (element === null) {
    throw new Error(
      `No element matching the selector "${target}" was found.`
    );
  }
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(
      `The element matching the selector "${target}" is not ` +
      "an HTMLCanvasElement."
    );
  }

  return element;
}

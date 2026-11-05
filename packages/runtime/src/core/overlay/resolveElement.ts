export function resolveElement<TElement extends Element>(
  target: TElement | string,
  type: new() => TElement,
  document: Document = globalThis.document
): TElement {
  if (typeof target !== "string") {
    if (!(target instanceof type)) {
      throw new TypeError(
        `Expected an ${type.name} or a CSS selector.`
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
  if (!(element instanceof type)) {
    throw new TypeError(
      `The element matching the selector "${target}" is not ` +
      `an ${type.name}.`
    );
  }

  return element;
}

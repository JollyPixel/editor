// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

/**
 * One computed property of an element, resolved in the page.
 */
export function styleOf(
  locator: Locator,
  property: string
): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property
  );
}

/**
 * One computed property of a part inside an element's shadow root.
 */
export function partStyleOf(
  locator: Locator,
  selector: string,
  property: string
): Promise<string> {
  return locator.evaluate(
    (element, [target, name]) => {
      const part = element.shadowRoot?.querySelector(target) ?? null;

      return part === null ?
        "" :
        getComputedStyle(part).getPropertyValue(name);
    },
    [selector, property] as const
  );
}

/**
 * Blur radius of a computed box-shadow, which is its third length.
 */
export async function shadowBlurOf(
  locator: Locator
): Promise<number> {
  const shadow = await styleOf(locator, "box-shadow");
  const lengths = shadow.match(/-?\d+(?:\.\d+)?px/g) ?? [];

  return lengths.length < 3 ? 0 : Number.parseFloat(lengths[2]);
}

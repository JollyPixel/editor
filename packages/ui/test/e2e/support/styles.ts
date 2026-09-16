// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

export function styleOf(
  locator: Locator,
  property: string,
  pseudo: string | null = null
): Promise<string> {
  return locator.evaluate(
    (element, [name, pseudoElement]) => getComputedStyle(element, pseudoElement)
      .getPropertyValue(name)
      .trim(),
    [property, pseudo] as const
  );
}

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
        getComputedStyle(part).getPropertyValue(name).trim();
    },
    [selector, property] as const
  );
}

export function resolvedColorOf(
  locator: Locator,
  value: string
): Promise<string> {
  return locator.evaluate(
    (element, color) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = color;
      element.append(probe);
      const resolved = getComputedStyle(probe).backgroundColor;
      probe.remove();

      return resolved;
    },
    value
  );
}

export async function shadowBlurOf(
  locator: Locator
): Promise<number> {
  const shadow = await styleOf(locator, "box-shadow");
  const lengths = shadow.match(/-?\d+(?:\.\d+)?px/g) ?? [];

  return lengths.length < 3 ? 0 : Number.parseFloat(lengths[2]);
}

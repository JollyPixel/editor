// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

export const TRANSPARENT = "rgba(0, 0, 0, 0)";

export function fieldControl(
  field: Locator
): Locator {
  return field.locator('input:not([type="color"])').first();
}

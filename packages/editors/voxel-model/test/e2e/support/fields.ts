// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

export function numberField(
  scope: Locator,
  label: string
): Locator {
  return scope.locator("jolly-number").filter({ hasText: label }).getByRole("textbox");
}

// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";

// CONSTANTS
const kSliceMs = 500;

export async function runUntilGone(
  page: Page,
  locator: Locator
): Promise<void> {
  await expect.poll(async() => {
    await page.clock.runFor(kSliceMs);

    return locator.count();
  }).toBe(0);
}

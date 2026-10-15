// Import Third-party Dependencies
import {
  expect,
  type Page
} from "@playwright/test";

export async function pickLighting(
  page: Page,
  mode: string
): Promise<void> {
  await page.getByRole("button", { name: /^Lighting:/ }).click();
  await page.getByRole("menuitem", { name: mode, exact: true }).click();
  await expect(page.getByRole("button", { name: `Lighting: ${mode}` })).toBeVisible();
}

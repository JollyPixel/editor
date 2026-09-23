// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export type PaneName = "General" | "Blocks" | "Paint" | "Layers";

export async function openPane(
  page: Page,
  name: PaneName
): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

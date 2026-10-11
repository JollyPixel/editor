// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import { openEditor } from "@jolly-pixel/e2e/editor";

export async function openOfflineEditor(
  page: Page
): Promise<void> {
  await openEditor(page, {
    maxFps: 5,
    query: {
      offline: ""
    }
  });
}

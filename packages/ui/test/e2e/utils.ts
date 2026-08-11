// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export interface GotoOptions {
  example?: string;
  chrome?: "off";
  theme?: "light" | "dark";
}

/**
 * Waits for the first example to mount, so a selector cannot resolve against
 * an empty document.
 */
export async function gotoGallery(
  page: Page,
  options: GotoOptions = {}
): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    params.set(key, value);
  }

  const query = params.toString();
  await page.goto(query === "" ? "/" : `/?${query}`);
  await page.waitForFunction(
    () => window.__galleryReady === true
  );
}

export function disposedIds(
  page: Page
): Promise<string[]> {
  return page.evaluate(
    () => window.__galleryDisposed ?? []
  );
}

// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export interface GotoOptions {
  example?: string;
  chrome?: "off";
  theme?: "light" | "dark";
  room?: string;
  as?: string;
  options?: Record<string, boolean>;
}

export type ExampleOptions = Omit<GotoOptions, "example" | "chrome">;

export async function gotoGallery(
  page: Page,
  options: GotoOptions = {}
): Promise<void> {
  const { options: exampleOptions = {}, ...rest } = options;
  const params = new URLSearchParams(rest);
  for (const [key, value] of Object.entries(exampleOptions)) {
    params.set(key, value ? "1" : "0");
  }

  const query = params.toString();
  await page.goto(query === "" ? "/" : `/?${query}`);
  await waitForGallery(page);
}

export function openExample(
  page: Page,
  example: string,
  options: ExampleOptions = {}
): Promise<void> {
  return gotoGallery(page, {
    ...options,
    example,
    chrome: "off"
  });
}

export async function reloadGallery(
  page: Page
): Promise<void> {
  await page.reload();
  await waitForGallery(page);
}

export function disposedIds(
  page: Page
): Promise<string[]> {
  return page.evaluate(
    () => window.__galleryDisposed ?? []
  );
}

async function waitForGallery(
  page: Page
): Promise<void> {
  await page.waitForFunction(
    () => window.__galleryReady === true
  );
}

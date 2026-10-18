// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export async function recordFieldChanges(
  page: Page
): Promise<void> {
  await page.evaluate(() => {
    window.__changes = [];
    document.addEventListener("jolly-change", (event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail: unknown = event.detail;
      if (typeof detail !== "object" || detail === null ||
        !("value" in detail)) {
        return;
      }

      window.__changes?.push(detail.value);
    });
  });
}

export function fieldChanges(
  page: Page
): Promise<unknown[]> {
  return page.evaluate(() => window.__changes ?? []);
}

export async function recordFieldInputs(
  page: Page
): Promise<void> {
  await page.evaluate(() => {
    window.__inputs = 0;
    document.addEventListener("jolly-input", () => {
      window.__inputs = (window.__inputs ?? 0) + 1;
    });
  });
}

export function fieldInputCount(
  page: Page
): Promise<number> {
  return page.evaluate(() => window.__inputs ?? 0);
}

export async function recordFieldInputValues(
  page: Page
): Promise<void> {
  await page.evaluate(() => {
    window.__inputValues = [];
    document.addEventListener("jolly-input", (event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail: unknown = event.detail;
      if (typeof detail !== "object" || detail === null ||
        !("value" in detail)) {
        return;
      }

      window.__inputValues?.push(detail.value);
    });
  });
}

export function fieldInputValues(
  page: Page
): Promise<unknown[]> {
  return page.evaluate(() => window.__inputValues ?? []);
}

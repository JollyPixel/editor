// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export async function recordEvents(
  page: Page,
  names: string[]
): Promise<void> {
  await page.evaluate((types) => {
    window.__events ??= [];
    for (const type of types) {
      document.addEventListener(type, (event) => {
        if (!(event instanceof CustomEvent)) {
          return;
        }

        const detail: unknown = event.detail;
        const value = typeof detail === "object" && detail !== null &&
          "value" in detail ? detail.value : undefined;
        window.__events?.push([type, value]);
      });
    }
  }, names);
}

export function recordedEvents(
  page: Page
): Promise<[string, unknown][]> {
  return page.evaluate(() => window.__events ?? []);
}

export function recordFieldChanges(
  page: Page
): Promise<void> {
  return recordEvents(page, ["jolly-change"]);
}

export function fieldChanges(
  page: Page
): Promise<unknown[]> {
  return recordedValues(page, "jolly-change");
}

export function recordFieldInputs(
  page: Page
): Promise<void> {
  return recordEvents(page, ["jolly-input"]);
}

export function fieldInputValues(
  page: Page
): Promise<unknown[]> {
  return recordedValues(page, "jolly-input");
}

export async function fieldInputCount(
  page: Page
): Promise<number> {
  return (await fieldInputValues(page)).length;
}

async function recordedValues(
  page: Page,
  name: string
): Promise<unknown[]> {
  const events = await recordedEvents(page);

  return events
    .filter(([type]) => type === name)
    .map(([, value]) => value);
}

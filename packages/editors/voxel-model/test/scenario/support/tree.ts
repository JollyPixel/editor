// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// CONSTANTS
const kDropKeys = {
  above: "ArrowRight",
  inside: "ArrowLeft",
  below: null
} as const;

export interface KeyboardDrop {
  down: number;
  where: keyof typeof kDropKeys;
}

export async function dropByKeyboard(
  row: Locator,
  drop: KeyboardDrop
): Promise<void> {
  await row.click();
  await row.press(" ");
  for (let step = 0; step < drop.down; step++) {
    await row.press("ArrowDown");
  }
  const key = kDropKeys[drop.where];
  if (key !== null) {
    await row.press(key);
  }
  await row.press("Enter");
}

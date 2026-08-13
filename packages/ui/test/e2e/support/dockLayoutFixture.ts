// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  boxOf,
  centerOf
} from "./pointer.ts";
import { gotoGallery } from "./gallery.ts";

// CONSTANTS
const kExample = "scenarios/dock-layout";

export function open(
  page: Page
): Promise<void> {
  return gotoGallery(page, {
    example: kExample,
    chrome: "off"
  });
}

export function paneKeysOf(
  page: Page,
  dock: string
): Promise<string[]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate(
    (element) => [...element.querySelectorAll("jolly-pane")].map(
      (pane) => pane.getAttribute("key") ?? ""
    )
  );
}

/**
 * Resizes the floating window by its own handles, one axis at a time.
 */
export async function resizeFrame(
  page: Page,
  size: { width: number; height: number; }
): Promise<void> {
  const frame = page.locator("jolly-floating");
  for (const edge of ["right", "bottom"] as const) {
    const box = await boxOf(frame);
    const grip = await centerOf(frame.locator(`.resize-handle.${edge}`));
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(
      edge === "right" ? box.x + size.width : grip.x,
      edge === "bottom" ? box.y + size.height : grip.y,
      { steps: 10 }
    );
    await page.mouse.up();
  }
}

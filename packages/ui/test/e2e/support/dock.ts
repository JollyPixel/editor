// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  boxOf,
  dragTo
} from "./pointer.ts";
import { openExample } from "./gallery.ts";

export function openDockLayout(
  page: Page
): Promise<void> {
  return openExample(page, "scenarios/dock-layout");
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

export function slotsOf(
  page: Page,
  dock: string
): Promise<string[][]> {
  return page.locator(`jolly-dock[key='${dock}']`).evaluate(
    (element) => [...element.children].map((child) => {
      if (child.tagName === "JOLLY-PANE") {
        return [child.getAttribute("key") ?? ""];
      }

      return [...child.querySelectorAll("jolly-pane")].map(
        (pane) => pane.getAttribute("key") ?? ""
      );
    })
  );
}

export async function resizeFrame(
  page: Page,
  size: { width: number; height: number; }
): Promise<void> {
  const frame = page.locator("jolly-floating");
  const box = await boxOf(frame);
  await dragTo(page, frame.locator(".resize-handle.right"), {
    x: box.x + size.width,
    y: box.y + (box.height / 2)
  });
  await dragTo(page, frame.locator(".resize-handle.bottom"), {
    x: box.x + (size.width / 2),
    y: box.y + size.height
  });
}

export async function dropIntoDock(
  page: Page,
  handle: string,
  dock: string,
  offsetFromBottom = 40
): Promise<void> {
  const box = await boxOf(page.locator(`jolly-dock[key='${dock}']`));
  await dragTo(page, page.locator(handle), {
    x: box.x + (box.width / 2),
    y: box.y + box.height - offsetFromBottom
  });
}

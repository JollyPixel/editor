// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  measureBox,
  type MouseButton,
  type Point
} from "../browser/pointer.ts";
import { nextFrames } from "./frames.ts";

export interface PressOptions {
  button?: MouseButton;
  frames?: number;
  target?: Locator;
}

export async function pressAt(
  page: Page,
  points: Iterable<Point>,
  options: PressOptions = {}
): Promise<void> {
  const {
    button = "left",
    frames,
    target
  } = options;
  const [first, ...rest] = points;
  if (first === undefined) {
    return;
  }

  if (target === undefined) {
    await page.mouse.move(first.x, first.y);
  }
  else {
    const box = await measureBox(target);
    await target.hover({
      position: {
        x: first.x - box.x,
        y: first.y - box.y
      }
    });
  }
  await nextFrames(page, frames);
  await page.mouse.down({ button });
  await nextFrames(page, frames);
  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await nextFrames(page, frames);
  }
  await page.mouse.up({ button });
  await nextFrames(page, frames);
}

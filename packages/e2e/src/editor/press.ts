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

export type PressModifier =
  | "Alt"
  | "Control"
  | "ControlOrMeta"
  | "Meta"
  | "Shift";

export interface PressOptions {
  button?: MouseButton;
  frames?: number;
  target?: Locator;
  modifiers?: readonly PressModifier[];
}

export async function hoverAt(
  page: Page,
  point: Point,
  target?: Locator
): Promise<void> {
  if (target === undefined) {
    await page.mouse.move(point.x, point.y);

    return;
  }

  const box = await measureBox(target);
  await target.hover({
    position: {
      x: point.x - box.x,
      y: point.y - box.y
    }
  });
}

export async function pressAt(
  page: Page,
  points: Iterable<Point>,
  options: PressOptions = {}
): Promise<void> {
  const {
    button = "left",
    frames,
    target,
    modifiers = []
  } = options;
  const [first, ...rest] = points;
  if (first === undefined) {
    return;
  }

  await hoverAt(page, first, target);

  const { keyboard } = page;
  for (const modifier of modifiers) {
    await keyboard.down(modifier);
  }
  try {
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
  finally {
    for (const modifier of modifiers.toReversed()) {
      await keyboard.up(modifier);
    }
  }
}

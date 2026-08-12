// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export interface Point {
  x: number;
  y: number;
}

export type Box = NonNullable<
  Awaited<ReturnType<Locator["boundingBox"]>>
>;

/**
 * Bounding box of a locator, refusing the null a hidden element reports.
 */
export async function boxOf(
  locator: Locator
): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("Element is not visible");
  }

  return box;
}

export async function centerOf(
  locator: Locator
): Promise<Point> {
  const box = await boxOf(locator);

  return {
    x: box.x + (box.width / 2),
    y: box.y + (box.height / 2)
  };
}

/**
 * Presses on a handle and releases over a point, in enough steps for a
 * session that resolves on movement to see the travel.
 */
export async function dragTo(
  page: Page,
  handle: Locator,
  target: Point
): Promise<void> {
  const from = await centerOf(handle);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 16 });
  await page.mouse.up();
}

export function heightOf(
  locator: Locator
): Promise<number> {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().height
  );
}

export function widthOf(
  locator: Locator
): Promise<number> {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().width
  );
}

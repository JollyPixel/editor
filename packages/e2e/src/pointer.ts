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

export type MouseButton = "left" | "right" | "middle";

export interface PressOptions {
  button?: MouseButton;
  settle?: (page: Page) => Promise<void>;
}

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

export function widthOf(
  locator: Locator
): Promise<number> {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().width
  );
}

export function heightOf(
  locator: Locator
): Promise<number> {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().height
  );
}

export async function hold(
  page: Page,
  from: Point,
  to: Point,
  steps = 12
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
}

export async function dragTo(
  page: Page,
  handle: Locator,
  target: Point
): Promise<void> {
  await hold(page, await centerOf(handle), target, 16);
  await page.mouse.up();
}

export async function scrubBy(
  page: Page,
  handle: Locator,
  distance: number
): Promise<void> {
  const from = await centerOf(handle);
  await hold(page, from, {
    x: from.x + distance,
    y: from.y
  }, 4);
  await page.mouse.up();
}

export async function pressAt(
  page: Page,
  points: Iterable<Point>,
  options: PressOptions = {}
): Promise<void> {
  const {
    button = "left",
    settle = async() => undefined
  } = options;
  const [first, ...rest] = points;
  if (first === undefined) {
    return;
  }

  await page.mouse.move(first.x, first.y);
  await settle(page);
  await page.mouse.down({ button });
  await settle(page);
  for (const point of rest) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await settle(page);
  }
  await page.mouse.up({ button });
  await settle(page);
}

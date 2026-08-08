// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  dragStroke,
  clickTexturePixel,
  readPixel,
  setBrushColor
} from "./utils.ts";

// Uses texture slice x:20-39, y:0-15 on the shared 80x80 canvas.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("contiguous fill stays inside a painted boundary", async({ page }) => {
  // Four dragStroke calls plus WebGL trace capture run close to the
  // default budget; give it the same headroom as the other ring-boundary
  // test below instead of risking a spurious timeout.
  test.slow();
  await setMode(page, "paint");
  // Build a ring boundary for flood-fill containment.
  await dragStroke(page, [{ x: 21, y: 1 }, { x: 28, y: 1 }]);
  await dragStroke(page, [{ x: 28, y: 1 }, { x: 28, y: 8 }]);
  await dragStroke(page, [{ x: 28, y: 8 }, { x: 21, y: 8 }]);
  await dragStroke(page, [{ x: 21, y: 8 }, { x: 21, y: 1 }]);

  await setMode(page, "fill");
  await clickTexturePixel(page, 24, 4);

  await expect.poll(
    () => readPixel(page, 24, 4)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  // Outside ring: should stay transparent.
  await expect.poll(
    () => readPixel(page, 32, 4)
  ).toMatchObject({ a: 0 });
});

test("global fill recolors every matching pixel canvas-wide", async({ page }) => {
  // Use a unique color so global fill only matches painted pixels.
  await setMode(page, "paint");
  await setBrushColor(page, "primary", "#123456");
  await clickTexturePixel(page, 24, 10);
  await clickTexturePixel(page, 26, 12);

  await setMode(page, "fill");
  // Move away first so hover opens the Global flyout cleanly.
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Fill", exact: true }).hover();
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await setBrushColor(page, "primary", "#654321");
  await clickTexturePixel(page, 24, 10);

  await expect.poll(
    () => readPixel(page, 24, 10)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 26, 12)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  // Unpainted pixel: must remain untouched.
  await expect.poll(
    () => readPixel(page, 25, 11)
  ).toMatchObject({ a: 0 });
});

test("right-click fill uses the secondary color", async({ page }) => {
  // Same cost profile as the ring-boundary test above.
  test.slow();
  await setMode(page, "paint");
  // Build a small ring boundary for flood-fill containment.
  await dragStroke(page, [{ x: 31, y: 1 }, { x: 34, y: 1 }]);
  await dragStroke(page, [{ x: 34, y: 1 }, { x: 34, y: 4 }]);
  await dragStroke(page, [{ x: 34, y: 4 }, { x: 31, y: 4 }]);
  await dragStroke(page, [{ x: 31, y: 4 }, { x: 31, y: 1 }]);

  await setMode(page, "fill");
  await setBrushColor(page, "secondary", "#ff8800");
  await clickTexturePixel(page, 32, 2, "right");

  await expect.poll(
    () => readPixel(page, 32, 2)
  ).toEqual({ r: 0xff, g: 0x88, b: 0, a: 255 });
  // Outside ring: should stay transparent.
  await expect.poll(
    () => readPixel(page, 37, 2)
  ).toMatchObject({ a: 0 });
});

/**
 * Read flyout width; CSS collapse is not `display: none`.
 */
function flyoutWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel");
    const modeRail = panel?.shadowRoot?.querySelector("mode-rail");
    // Target the flyout that contains the "Global" button.
    const flyout = modeRail?.shadowRoot?.querySelector('.rail-flyout:has(button[title="Global"])');

    return flyout ? flyout.getBoundingClientRect().width : -1;
  });
}

test("clicking a mode button does not leave its flyout open once the mouse moves away", async({ page }) => {
  const fillButton = page.getByRole("button", { name: "Fill", exact: true });

  // Hover opens the flyout, then click the mode button itself.
  await fillButton.hover();
  await expect.poll(() => flyoutWidth(page)).toBeGreaterThan(0);
  await fillButton.click();

  // Move away; :focus-within must not keep the flyout open.
  await page.mouse.move(0, 0);
  await expect.poll(() => flyoutWidth(page)).toBe(0);
});

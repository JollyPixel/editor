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
  readPixel
} from "./utils.ts";

// This file uses texture slice x:20-39, y:0-15 on the shared 80x80 canvas.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

function setBrushPrimary(
  page: Page,
  hex: string
): Promise<void> {
  return page.evaluate((color) => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: { brush: { primary: { set(hex: string, opacity?: number): void; }; }; };
    };
    panel.canvasManager.brush.primary.set(color, 1);
  }, hex);
}

test("contiguous fill stays inside a painted boundary", async({ page }) => {
  await setMode(page, "paint");
  // Build a ring wall first. Flood fill must stay boxed in.
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
  // Seed with a weird color so global fill only hits pixels we painted.
  await setMode(page, "paint");
  await setBrushPrimary(page, "#123456");
  await clickTexturePixel(page, 24, 10);
  await clickTexturePixel(page, 26, 12);

  await setMode(page, "fill");
  // Flip mode: Neighbor -> Global, via the rail's hover flyout. The mouse is
  // already resting on the Fill button from setMode's click above, and the
  // mode click now closes its own flyout on click (so it isn't left open
  // after selecting a mode) — move away first so hover below is a genuine
  // mouseenter, not a same-position no-op.
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Fill", exact: true }).hover();
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await setBrushPrimary(page, "#654321");
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

/**
 * The flyout's closed state is a `max-width: 0; overflow: hidden` collapse,
 * not a `display: none` — so the flyout button keeps its own layout box and
 * Playwright's toBeVisible()/toBeHidden() can't tell the two states apart.
 * Read the container's own collapsed width instead.
 */
function flyoutWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel");
    const modeRail = panel?.shadowRoot?.querySelector("mode-rail");
    // Move/UV render no flyout at all, and Paint's is always present, so a
    // bare ".rail-flyout" query can match the wrong item — target the one
    // holding the "Global" button specifically.
    const flyout = modeRail?.shadowRoot?.querySelector('.rail-flyout:has(button[title="Global"])');

    return flyout ? flyout.getBoundingClientRect().width : -1;
  });
}

test("clicking a mode button does not leave its flyout open once the mouse moves away", async({ page }) => {
  const fillButton = page.getByRole("button", { name: "Fill", exact: true });

  // Hover opens the flyout, then click the mode button itself (not the
  // flyout button) — this both sets mode and focuses the button.
  await fillButton.hover();
  await expect.poll(() => flyoutWidth(page)).toBeGreaterThan(0);
  await fillButton.click();

  // Move the mouse away: a lingering :focus-within on the clicked button
  // must not keep the flyout open on its own.
  await page.mouse.move(0, 0);
  await expect.poll(() => flyoutWidth(page)).toBe(0);
});

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("the color picker docking preference survives reloads", async({ panel }) => {
  const { colors } = panel;
  await expect(colors.dockToggle).toHaveAttribute("aria-pressed", "false");

  for (const docked of [true, false]) {
    await colors.toggleDock();
    await panel.reload();

    await expect(colors.dockToggle).toHaveAttribute("aria-pressed", String(docked));
    if (docked) {
      await expect(colors.dock).toBeVisible();
    }
    else {
      await expect(colors.dock).toBeHidden();
    }
  }
});

test("picking a foreground color in the swatch paints with it", async({ panel }) => {
  const { colors } = panel;
  await panel.modes.select("paint");
  await colors.foreground.click();
  await colors.popoverPicker.commit("#ff00ff");
  await expect.poll(() => colors.brush()).toMatchObject({ primary: "#ff00ff" });

  await panel.canvas.click({ x: 10, y: 25 });

  await expect.poll(() => panel.canvas.pixels([{ x: 10, y: 25 }]))
    .toEqual(["#ff00ffff"]);
});

test("the eyedropper picks a canvas pixel into the primary color", async({ panel }) => {
  await panel.canvas.seed([{ x: 5, y: 30, color: "#3355ff" }]);
  await panel.modes.select("paint");
  await panel.modes.pick("paint", "Pick color");

  await panel.canvas.click({ x: 5, y: 30 });
  await expect.poll(() => panel.colors.brush()).toMatchObject({ primary: "#3355ff" });

  await panel.canvas.click({ x: 15, y: 32 });
  await expect.poll(() => panel.canvas.pixels([
    { x: 5, y: 30 },
    { x: 15, y: 32 }
  ])).toEqual(["#3355ffff", "#3355ffff"]);
});

test("the swap button exchanges foreground and background colors", async({ panel }) => {
  const { colors } = panel;
  await colors.assign("primary", "#111111");
  await colors.assign("secondary", "#222222");

  await colors.swap.click();

  await expect.poll(() => colors.brush()).toEqual({
    primary: "#222222",
    secondary: "#111111"
  });
});

test("docking shrinks the stage, folds the swatches and shares one color", async({ panel }) => {
  const { colors } = panel;
  await colors.assign("primary", "#123456");
  await colors.assign("secondary", "#abcdef");
  const undocked = await panel.canvas.stage.boundingBox();

  await colors.toggleDock();

  await expect(colors.dock).toBeVisible();
  await expect(colors.dockToggle).toHaveAttribute("aria-pressed", "true");
  await expect(colors.foreground).toBeDisabled();
  await expect(colors.foreground).toBeVisible();
  await expect(colors.foreground).toHaveCSS("opacity", "1");
  await expect(colors.background).toBeDisabled();
  await expect(colors.backgroundSwatch).toBeHidden();
  const swap = panel.root.locator("color-picker-rail .swap-btn");
  await expect(swap).toBeDisabled();
  await expect(swap).toBeHidden();
  await expect.poll(() => colors.brush()).toEqual({
    primary: "#123456",
    secondary: "#123456"
  });
  await expect.poll(async() => (await panel.canvas.stage.boundingBox())!.height)
    .toBeLessThanOrEqual(undocked!.height - 140);
});

test("the docked picker color paints with the right mouse button", async({ panel }) => {
  await panel.modes.select("paint");
  await panel.colors.toggleDock();
  await panel.colors.dockedPicker.commit("#ff00ff");

  await panel.canvas.click({ x: 12, y: 28 }, "right");

  await expect.poll(() => panel.canvas.pixels([{ x: 12, y: 28 }]))
    .toEqual(["#ff00ffff"]);
});

test("undocking restores the background color and reports each toggle", async({ panel }) => {
  const { colors } = panel;
  await colors.assign("secondary", "#222222");
  const events = await panel.root.evaluateHandle((element: PixelDrawPanel) => {
    const collected: boolean[] = [];
    element.addEventListener("color-docked-change", (event) => {
      collected.push(event.detail);
    });

    return collected;
  });
  const undocked = await panel.canvas.stage.boundingBox();

  await colors.toggleDock();
  await colors.toggleDock();

  await expect(colors.dock).toBeHidden();
  await expect(colors.dock).toHaveJSProperty("inert", true);
  await expect.poll(async() => (await panel.canvas.stage.boundingBox())!.height)
    .toBe(undocked!.height);
  await expect(colors.background).toBeEnabled();
  expect(await events.jsonValue()).toEqual([true, false]);
  expect((await colors.brush()).secondary).toBe("#222222");
});

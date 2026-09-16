// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  clickTexturePixel,
  clickToolOption,
  readBrush,
  readPixels,
  seedTexture,
  setBrushColor,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

async function toggleDock(
  panel: Locator
): Promise<void> {
  await panel.getByRole("button", { name: "Docked color picker" }).click();
}

test("picking a foreground color in the swatch paints with it", async({ panel }) => {
  await setMode(panel, "paint");
  await panel.locator("color-swatch.fg button").click();
  const hex = panel.locator("jolly-color-picker input.hex").visible();
  await hex.fill("#ff00ff");
  await hex.press("Enter");
  await expect.poll(() => readBrush(panel)).toMatchObject({ primary: "#ff00ff" });

  await clickTexturePixel(panel, { x: 10, y: 25 });

  await expect.poll(() => readPixels(panel, [{ x: 10, y: 25 }]))
    .toEqual(["#ff00ffff"]);
});

test("the eyedropper picks a canvas pixel into the primary color", async({ panel }) => {
  await seedTexture(panel, [{ x: 5, y: 30, color: "#3355ff" }]);
  await setMode(panel, "paint");
  await clickToolOption(panel, "paint", "Pick color");

  await clickTexturePixel(panel, { x: 5, y: 30 });
  await expect.poll(() => readBrush(panel)).toMatchObject({ primary: "#3355ff" });

  await clickTexturePixel(panel, { x: 15, y: 32 });
  await expect.poll(() => readPixels(panel, [
    { x: 5, y: 30 },
    { x: 15, y: 32 }
  ])).toEqual(["#3355ffff", "#3355ffff"]);
});

test("the swap button exchanges foreground and background colors", async({ panel }) => {
  await setBrushColor(panel, "primary", "#111111");
  await setBrushColor(panel, "secondary", "#222222");

  await panel.getByRole("button", {
    name: "Swap foreground and background colors"
  }).click();

  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#222222",
    secondary: "#111111"
  });
});

test("docking shrinks the stage, disables the swatches and shares one color", async({ panel }) => {
  await setBrushColor(panel, "primary", "#123456");
  await setBrushColor(panel, "secondary", "#abcdef");
  const stage = panel.locator(".stage");
  const undocked = await stage.boundingBox();

  await toggleDock(panel);

  await expect(panel.locator("color-dock")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Docked color picker" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("color-swatch.fg button")).toBeDisabled();
  await expect(panel.locator("color-swatch.bg button")).toBeDisabled();
  await expect(panel.getByRole("button", {
    name: "Swap foreground and background colors"
  })).toBeDisabled();
  await expect.poll(() => readBrush(panel)).toEqual({
    primary: "#123456",
    secondary: "#123456"
  });
  expect((await stage.boundingBox())!.height).toBeLessThan(undocked!.height);
});

test("the docked picker color paints with the right mouse button", async({ panel }) => {
  await setMode(panel, "paint");
  await toggleDock(panel);
  const hex = panel.locator("color-dock jolly-color-picker input.hex");
  await hex.fill("#ff00ff");
  await hex.press("Enter");

  await clickTexturePixel(panel, { x: 12, y: 28 }, "right");

  await expect.poll(() => readPixels(panel, [{ x: 12, y: 28 }]))
    .toEqual(["#ff00ffff"]);
});

test("undocking restores the background color and reports each toggle", async({ panel }) => {
  await setBrushColor(panel, "secondary", "#222222");
  const events = await panel.evaluateHandle((element: PixelDrawPanel) => {
    const collected: boolean[] = [];
    element.addEventListener("color-docked-change", (event) => {
      collected.push(event.detail);
    });

    return collected;
  });

  await toggleDock(panel);
  await toggleDock(panel);

  await expect(panel.locator("color-dock")).toHaveCount(0);
  await expect(panel.locator("color-swatch.bg button")).toBeEnabled();
  expect(await events.jsonValue()).toEqual([true, false]);
  expect((await readBrush(panel)).secondary).toBe("#222222");
});

// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  activeMode,
  clickToolOption,
  setMode
} from "./utils.ts";
import type {
  PixelDrawPanel,
  UvAccess
} from "../../src/index.ts";

async function setUvAccess(
  panel: Locator,
  access: UvAccess
): Promise<void> {
  await panel.evaluate((element: PixelDrawPanel, value) => {
    element.uvAccess = value;

    return element.updateComplete;
  }, access);
}

test("view hides UV mode but moves the visibility toggles to the bottom toolbar", async({ panel }) => {
  await setUvAccess(panel, "view");

  await expect(panel.getByRole("button", { name: "UV", exact: true })).toHaveCount(0);
  await expect(panel.locator("[part=uv-toolbar]")).toHaveCount(0);

  const bottom = panel.locator("[part=history-file-toolbar]");
  for (const name of ["Show all", "Show region labels"]) {
    const toggle = bottom.getByRole("button", { name });
    const pressed = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-pressed", pressed!);
  }
});

test("leaving edit while in UV mode falls back to Paint", async({ panel }) => {
  await setMode(panel, "uv");
  await expect(panel.locator("[part=uv-toolbar]")).toBeVisible();

  await setUvAccess(panel, "view");

  expect(await activeMode(panel)).toBe("paint");
  await expect(panel.getByRole("button", { name: "Paint", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("[part=uv-toolbar]")).toHaveCount(0);
});

test("none removes every UV control and turns the fill clip off", async({ panel }) => {
  await setMode(panel, "fill");
  await clickToolOption(panel, "fill", "Clip to UV");
  function uvClip() {
    return panel.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.tools.fill.uvClip
    );
  }
  expect(await uvClip()).toBe(true);

  await setUvAccess(panel, "none");

  expect(await uvClip()).toBe(false);
  for (const name of ["UV", "Clip to UV", "Show all", "Show region labels"]) {
    await expect(panel.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(panel.locator("mode-rail [part=uv-clip-badge]")).toHaveCount(0);
});

test("removing the uv-access attribute restores edit", async({ panel }) => {
  const uvMode = panel.getByRole("button", { name: "UV", exact: true });

  await panel.evaluate((element) => element.setAttribute("uv-access", "view"));
  await expect(uvMode).toHaveCount(0);

  await panel.evaluate((element) => element.removeAttribute("uv-access"));
  await expect(uvMode).toBeVisible();
});

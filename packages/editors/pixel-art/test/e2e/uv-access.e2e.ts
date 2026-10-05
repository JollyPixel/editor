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

test("view moves region visibility to the bottom toolbar and opens on hover", async({ panel, page }) => {
  await setUvAccess(panel, "view");

  await expect(panel.getByRole("button", { name: "UV", exact: true })).toHaveCount(0);
  await expect(panel.locator("[part=uv-toolbar]")).toHaveCount(0);

  const bottom = panel.locator("[part=history-file-toolbar]");
  const trigger = bottom.getByRole("button", { name: "Region visibility" });
  await trigger.hover();
  const menu = panel.getByRole("dialog", { name: "Region visibility" });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Show all regions", "Show region labels"]) {
    const toggle = menu.getByRole("checkbox", { name });
    const checked = await toggle.isChecked();
    await toggle.setChecked(!checked);
    await expect(toggle).toBeChecked({ checked: !checked });
  }
  const buttonBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(buttonBox!.y);
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await setUvAccess(panel, "none");
  await expect(trigger).toHaveCount(0);
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
  for (const name of ["UV", "Clip to UV", "Region visibility"]) {
    await expect(panel.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(panel.locator("mode-rail [part=uv-clip-badge]")).toHaveCount(0);
});

test("an open visibility popover closes when access moves its trigger", async({ panel }) => {
  await setMode(panel, "uv");
  const trigger = panel.getByRole("button", { name: "Region visibility" });
  await trigger.click();
  await expect(panel.getByRole("dialog", { name: "Region visibility" }))
    .toBeVisible();
  await setUvAccess(panel, "view");
  await expect(panel.getByRole("dialog", { name: "Region visibility" }))
    .not.toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(panel.getByRole("dialog", { name: "Region visibility" }))
    .toBeVisible();
});

test("hover delays cancel across the trigger, gap and visibility popover", async({ panel, page }) => {
  await setUvAccess(panel, "view");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const trigger = panel.getByRole("button", { name: "Region visibility" });
  const menu = panel.getByRole("dialog", { name: "Region visibility" });
  await trigger.hover();
  await page.clock.runFor(199);
  await expect(menu).not.toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(201);
  await expect(menu).not.toBeVisible();
  await trigger.hover();
  await page.clock.runFor(200);
  await expect(menu).toBeVisible();
  await expect(trigger).not.toBeFocused();
  await menu.hover();
  await page.clock.runFor(201);
  await expect(menu).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(199);
  await expect(menu).toBeVisible();
  await trigger.hover();
  await page.clock.runFor(201);
  await expect(menu).toBeVisible();
  await menu.hover();
  await page.mouse.move(0, 0);
  await page.clock.runFor(200);
  await expect(menu).not.toBeVisible();
  await trigger.focus();
  await trigger.press("Enter");
  const labels = menu.getByRole("checkbox", { name: "Show region labels" });
  await labels.focus();
  await menu.hover();
  await page.mouse.move(0, 0);
  await page.clock.runFor(201);
  await expect(menu).toBeVisible();
  await labels.press("Escape");
  await expect(menu).not.toBeVisible();
  await trigger.hover();
  await page.clock.runFor(200);
  await labels.check();
  await page.mouse.move(0, 0);
  await page.clock.runFor(199);
  await expect(menu).toBeVisible();
  await page.clock.runFor(1);
  await expect(menu).not.toBeVisible();
});

test("removing the uv-access attribute restores edit", async({ panel }) => {
  const uvMode = panel.getByRole("button", { name: "UV", exact: true });

  await panel.evaluate((element) => element.setAttribute("uv-access", "view"));
  await expect(uvMode).toHaveCount(0);

  await panel.evaluate((element) => element.removeAttribute("uv-access"));
  await expect(uvMode).toBeVisible();
});

test("visibility popovers animate quickly and respect reduced motion", async({ panel, page }) => {
  await setUvAccess(panel, "view");
  const menu = panel.locator("[part=uv-visibility-menu]");
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    const motion = await menu.evaluate((element: HTMLElement) => {
      getComputedStyle(element).getPropertyValue("opacity");
      element.showPopover();
      const opacity = Number(getComputedStyle(element).opacity);
      const durations = element.getAnimations().map(
        (animation) => Number(animation.effect!.getTiming().duration)
      );

      return { opacity, durations };
    });
    if (reducedMotion === "reduce") {
      expect(motion.opacity).toBe(1);
      expect(motion.durations).toEqual([]);
    }
    else {
      expect(motion.opacity).toBeLessThan(1);
      expect(motion.durations.length).toBeGreaterThan(0);
      expect(Math.max(...motion.durations)).toBeLessThanOrEqual(150);
    }
    await expect(menu).toHaveCSS("opacity", "1");
    await menu.evaluate((element: HTMLElement) => element.hidePopover());
    await expect(menu).not.toBeVisible();
  }
});

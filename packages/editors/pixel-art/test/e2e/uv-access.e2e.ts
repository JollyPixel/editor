// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("view moves region visibility to the bottom toolbar and opens on hover", async({ panel, page }) => {
  await panel.changeUvAccess("view");

  await expect(panel.modes.button("uv")).toHaveCount(0);
  await expect(panel.uv.root).toHaveCount(0);

  const trigger = panel.bottomToolbar.getByRole("button", { name: "Region visibility" });
  const { menu } = panel.visibility;
  await trigger.hover();
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
  await panel.changeUvAccess("none");
  await expect(trigger).toHaveCount(0);
});

test("leaving edit while in UV mode falls back to Paint", async({ panel }) => {
  await panel.modes.select("uv");
  await expect(panel.uv.root).toBeVisible();

  await panel.changeUvAccess("view");

  expect(await panel.modes.active()).toBe("paint");
  await expect(panel.modes.button("paint")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.uv.root).toHaveCount(0);
});

test("none removes every UV control and turns the fill clip off", async({ panel }) => {
  await panel.modes.select("fill");
  await panel.modes.pick("fill", "Clip to UV");
  function uvClip() {
    return panel.root.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.tools.fill.uvClip
    );
  }
  expect(await uvClip()).toBe(true);

  await panel.changeUvAccess("none");

  expect(await uvClip()).toBe(false);
  for (const name of ["UV", "Clip to UV", "Region visibility"]) {
    await expect(panel.root.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(panel.modes.clipBadge).toHaveCount(0);
});

test("an open visibility popover closes when access moves its trigger", async({ panel }) => {
  const { trigger, menu } = panel.visibility;
  await panel.modes.select("uv");
  await trigger.click();
  await expect(menu).toBeVisible();
  await panel.changeUvAccess("view");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(menu).toBeVisible();
});

test("hover delays cancel across the trigger, gap and visibility popover", async({ panel, page }) => {
  await panel.changeUvAccess("view");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const { trigger, menu } = panel.visibility;
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
  const uvMode = panel.modes.button("uv");

  await panel.root.evaluate((element) => element.setAttribute("uv-access", "view"));
  await expect(uvMode).toHaveCount(0);

  await panel.root.evaluate((element) => element.removeAttribute("uv-access"));
  await expect(uvMode).toBeVisible();
});

test("visibility popovers animate quickly and respect reduced motion", async({ panel, page }) => {
  await panel.changeUvAccess("view");
  const menu = panel.root.locator("[part=uv-visibility-menu]");
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

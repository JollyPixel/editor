// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("bottom toolbar stays reachable as the panel narrows", async({ panel }) => {
  const { normalMap, visibility } = panel;
  await normalMap.enable();
  await panel.changeUvAccess("view");

  for (const width of [600, 350, 240]) {
    await panel.root.evaluate((element, value) => {
      element.style.width = `${value}px`;
      element.style.flex = "none";
    }, width);
    await expect.poll(() => panel.root.evaluate((element) => {
      const root = element.shadowRoot!;
      const stage = root.querySelector(".stage")!.getBoundingClientRect();
      const buttons = root.querySelectorAll(
        "[part=history-file-toolbar] button:not([role=menuitem])"
      );

      return Array.from(buttons).every((button) => {
        const box = button.getBoundingClientRect();

        return box.width > 0 && box.left >= stage.left + 7 &&
          box.right <= stage.right - 7 && box.bottom <= stage.bottom;
      });
    })).toBe(true);
    await normalMap.normalView.click();
    await expect(normalMap.normalView).toHaveAttribute("aria-checked", "true");
    await normalMap.albedoView.click();
    await visibility.open();
    await expect(visibility.menu.getByRole("checkbox", { name: "Show region labels" }))
      .toBeVisible();
    const menuBox = await visibility.menu.boundingBox();
    const triggerBox = await visibility.trigger.boundingBox();
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(triggerBox!.y);
    await visibility.menu.getByRole("checkbox", { name: "Show region labels" })
      .press("Escape");
  }
});

test("normal map toolbar actions appear only while enabled", async({ panel }) => {
  const { normalMap } = panel;
  const { exportMenu, override, enableBox, views, normalView } = normalMap;
  await panel.modes.select("uv");

  await expect(exportMenu).toBeHidden();
  await expect(panel.exportButton).toBeVisible();
  await expect(override).toBeHidden();
  await expect(views).toHaveCount(0);

  await normalMap.enable();
  await expect(exportMenu).toBeVisible();
  await expect(exportMenu).toBeEnabled();
  await expect(override).toBeVisible();
  await expect(override).toBeDisabled();
  await expect(views).toBeVisible();
  await normalView.click();
  await expect(normalView).toHaveAttribute("aria-checked", "true");

  await enableBox.uncheck();
  await expect(views).toHaveCount(0);
  expect((await panel.normalMap.state()).view).toBe("albedo");
  await expect(panel.modes.button("paint")).toBeEnabled();
  await expect(exportMenu).toBeHidden();
  await expect(override).toBeHidden();

  await enableBox.check();
  await expect(exportMenu).toBeVisible();
  await expect(exportMenu).toBeEnabled();
  await expect(override).toBeVisible();
  await expect(views).toBeVisible();
  await expect(normalMap.albedoView).toHaveAttribute("aria-checked", "true");
});

test("export menu highlights the hovered and keyboard-focused row", async({ panel, page }) => {
  const { normalMap } = panel;
  await normalMap.enable();

  for (const theme of ["light", "dark"] as const) {
    await panel.root.evaluate((element: PixelDrawPanel, value) => {
      element.theme = value;
    }, theme);
    await normalMap.exportMenu.click();
    const albedo = normalMap.exportItem("Albedo texture");
    const opengl = normalMap.exportItem("Normal map — OpenGL (Y+)");
    const directx = normalMap.exportItem("Normal map — DirectX (Y-)");
    const idle = await opengl.evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ));

    await opengl.hover();
    await expect(opengl).not.toHaveCSS("background-color", idle);
    await directx.hover();
    await expect(opengl).toHaveCSS("background-color", idle);
    await expect(directx).not.toHaveCSS("background-color", idle);

    await normalMap.exportMenu.hover();
    await albedo.focus();
    await page.keyboard.press("Tab");
    await expect(opengl).toBeFocused();
    await expect(opengl).not.toHaveCSS("background-color", idle);
    await page.keyboard.press("Escape");
    await expect(opengl).toBeHidden();
  }
});

test("the color dock and the normal map dock never open together", async({ panel }) => {
  const { colors, normalMap } = panel;

  await colors.dockToggle.click();
  await expect(colors.dock).toHaveAttribute("open", "");

  await normalMap.toggle.click();
  await expect(normalMap.root).toHaveAttribute("open", "");
  await normalMap.enableBox.check();
  await expect(colors.dock).not.toHaveAttribute("open", "");
  await expect(panel.root).not.toHaveAttribute("color-docked", "");

  await colors.dockToggle.click();
  await expect(colors.dock).toHaveAttribute("open", "");
  await expect(normalMap.root).not.toHaveAttribute("open", "");

  await normalMap.normalView.click();
  await expect(normalMap.root).toHaveAttribute("open", "");
  await expect(colors.dock).not.toHaveAttribute("open", "");
});

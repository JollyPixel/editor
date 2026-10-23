// Import Third-party Dependencies
import { measureBox } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect,
  type Locator,
  type Page
} from "../fixtures.ts";
import type { ColorPicker } from "../../../src/controls/ColorPicker.ts";

function panel(
  page: Page,
  name: string
): Locator {
  return page.locator(".state-row", {
    has: page.locator(`[data-readout="${name}"]`)
  });
}

function axis(
  picker: Locator,
  label: string
): Locator {
  return picker.locator(`.area input[aria-label="${label}"]`);
}

async function axisValue(
  picker: Locator,
  label: string
): Promise<number> {
  return Number(await axis(picker, label).inputValue());
}

test.describe("color picker: wheel", () => {
  test.use({
    example: "controls/color-picker"
  });

  test("paints the wheel and picks hue from the angle, saturation from the radius", async({ page }) => {
    const picker = panel(page, "wheel").locator("jolly-color-picker");
    const area = picker.locator(".area.wheel");
    await area.scrollIntoViewIfNeeded();
    const painted = await area.locator("canvas.surface").evaluate((canvas: HTMLCanvasElement) => {
      const pixel = canvas.getContext("2d")!.getImageData(canvas.width - 2, canvas.height / 2, 1, 1).data;

      return pixel[3];
    });
    expect(painted).toBe(255);

    const box = await measureBox(area);
    await page.mouse.click(box.x + (box.width * 0.75), box.y + (box.height / 2));

    await expect.poll(() => axisValue(picker, "Hue")).toBe(90);
    await expect.poll(() => axisValue(picker, "Saturation")).toBeGreaterThan(480);
    expect(await axisValue(picker, "Saturation")).toBeLessThan(520);
    await expect(panel(page, "wheel").locator("[data-readout]"))
      .not.toHaveText("#c3567f");
  });

  test("a discrete wheel snaps to hue sectors and saturation rings", async({ page }) => {
    const picker = panel(page, "okhsv discrete wheel").locator("jolly-color-picker");
    const area = picker.locator(".area.wheel");
    await area.scrollIntoViewIfNeeded();
    const box = await measureBox(area);

    await page.mouse.click(box.x + (box.width * 0.71), box.y + (box.height * 0.2));

    expect((await axisValue(picker, "Hue")) % 30).toBe(0);
    expect((await axisValue(picker, "Saturation")) % 250).toBe(0);

    await axis(picker, "Hue").focus();
    const before = await axisValue(picker, "Hue");
    await page.keyboard.press("ArrowRight");
    expect(await axisValue(picker, "Hue")).toBe(Math.min(before + 30, 360));
  });

  test("the settings button switches every default picker to a wheel", async({ page }) => {
    const picker = panel(page, "settings").locator("jolly-color-picker");
    const toggle = picker.locator(".settings-toggle");
    await panel(page, "readonly").locator("jolly-color-picker").evaluate((element: ColorPicker) => {
      element.selector = "square";
    });

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await picker.locator(".settings select").nth(1).selectOption("wheel");

    await expect(picker.locator(".area.wheel")).toBeVisible();
    await expect(panel(page, "default").locator(".area.wheel")).toBeVisible();
    await expect(panel(page, "readonly").locator(".area.wheel")).toHaveCount(0);
  });

  test("a harmony swatch commits on click and reports a secondary pick on right click", async({ page }) => {
    await page.evaluate(() => {
      window.harmonyPicks = [];
      document.addEventListener("jolly-secondary", (event) => {
        window.harmonyPicks.push((event as CustomEvent).detail);
      });
    });
    const cell = panel(page, "wheel");
    const readout = cell.locator("[data-readout]");
    const swatches = cell.locator(".harmony-swatch");
    await expect(swatches).toHaveCount(2);
    await expect(cell.locator(".harmony-marker")).toHaveCount(2);

    const second = await swatches.nth(1).getAttribute("aria-label");
    await swatches.nth(1).click({ button: "right" });
    await expect(readout).toHaveText("#c3567f");

    const first = await swatches.first().getAttribute("aria-label");
    await swatches.first().click();
    await expect(readout).toHaveText(first!.replace("Harmony color ", ""));

    expect(await page.evaluate(() => window.harmonyPicks)).toEqual([
      {
        value: second!.replace("Harmony color ", "")
      }
    ]);
  });
});

declare global {
  interface Window {
    harmonyPicks: unknown[];
  }
}

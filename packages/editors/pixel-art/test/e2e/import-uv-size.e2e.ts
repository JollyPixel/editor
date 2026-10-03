// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect,
  demo
} from "./fixtures.ts";
import {
  importFile,
  pngFile
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kImportSize = {
  x: 64,
  y: 64
};

function uniqueName(
  slug: string
): string {
  return `e2e-${slug}-${Date.now()}`;
}

function activeRegions(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { uv } = element.canvasManager!;

    return {
      selected: uv.selectedRegionId,
      regions: [...uv.regions].map((region) => {
        const { width, height } = region.bounds;

        return {
          id: region.id,
          width,
          height
        };
      })
    };
  });
}

test.describe("UV size on import", () => {
  test.use({ editor: demo({ importPolicy: "ask" }) });

  test("Add as new creates a cube of the picked UV size", async({ panel, page }) => {
    const tabs = panel.getByRole("tab");
    const count = Math.max(await tabs.count(), 1);
    const name = uniqueName("uv-size");
    await importFile(panel, await pngFile(`${name}.png`, kImportSize));

    const select = page.locator("[part=import-uv-size] select");
    await expect(select.locator("option")).toHaveText([
      "16 × 16",
      "32 × 32",
      "64 × 64",
      "128 × 128",
      "256 × 256"
    ]);
    await expect(select.locator("option:disabled")).toHaveText([
      "128 × 128",
      "256 × 256"
    ]);
    await expect(select.locator("option:checked")).toHaveText("16 × 16");
    await select.selectOption({ label: "32 × 32" });
    await page.getByRole("button", { name: "Add as new" }).click();

    await expect(tabs).toHaveCount(count + 1);
    await expect(tabs.last()).toHaveText(name);
    await expect.poll(() => activeRegions(panel)).toMatchObject({
      regions: [{ width: 32, height: 32 }]
    });
    const { selected, regions } = await activeRegions(panel);
    expect(selected).toBe(regions[0].id);
  });

  test("an image smaller than every UV size shows no select", async({ panel, page }) => {
    await importFile(panel, await pngFile(`${uniqueName("uv-tiny")}.png`, {
      x: 8,
      y: 8
    }));

    await expect(page.getByRole("button", { name: "Add as new" })).toBeVisible();
    await expect(page.locator("[part=import-uv-size]")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});

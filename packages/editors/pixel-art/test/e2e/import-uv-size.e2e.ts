// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import {
  pngFile,
  uniqueName
} from "./support/files.ts";
import type { PixelArtPanel } from "./support/panel.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kImportSize = {
  x: 64,
  y: 64
};

function activeRegions(
  panel: PixelArtPanel
) {
  return panel.root.evaluate((element: PixelDrawPanel) => {
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
  test.use({ editor: playground({ importPolicy: "ask" }) });

  test("Add as new creates a cube of the picked UV size", async({ panel, page }) => {
    const { tabs } = panel.textures;
    const count = Math.max(await tabs.count(), 1);
    const name = uniqueName("uv-size");
    await panel.import(await pngFile(`${name}.png`, kImportSize));

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
    await panel.importDialog.addAsNew.click();

    await expect(tabs).toHaveCount(count + 1);
    await expect(tabs.last()).toHaveText(name);
    await expect.poll(() => activeRegions(panel)).toMatchObject({
      regions: [{ width: 32, height: 32 }]
    });
    const { selected, regions } = await activeRegions(panel);
    expect(selected).toBe(regions[0].id);
  });

  test("an image smaller than every UV size shows no select", async({ panel, page }) => {
    await panel.import(await pngFile(`${uniqueName("uv-tiny")}.png`, {
      x: 8,
      y: 8
    }));

    await expect(panel.importDialog.addAsNew).toBeVisible();
    await expect(page.locator("[part=import-uv-size]")).toHaveCount(0);
    await panel.importDialog.cancel.click();
  });
});

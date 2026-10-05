// Import Third-party Dependencies
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import {
  activeMode,
  importFile,
  pngFile,
  setMode
} from "./utils.ts";

test("drawing modes survive refresh", async({ panel, page }) => {
  for (const mode of ["erase", "fill", "select", "move", "uv", "paint"] as const) {
    await setMode(panel, mode);
    await page.reload();
    await waitForEditor(page);
    expect(await activeMode(panel)).toBe(mode);
  }
});

test("invalid stored preferences fall back without losing valid fields", async({ panel, page }) => {
  for (const state of [
    { raw: "{broken", mode: "paint" },
    {
      raw: JSON.stringify({ mode: "unknown", showAll: "true" }),
      mode: "paint"
    },
    {
      raw: JSON.stringify({ mode: "uv", showRegionLabels: "true" }),
      mode: "uv"
    }
  ]) {
    await page.evaluate((value) => {
      localStorage.setItem("pixel-art:preferences", value);
    }, state.raw);
    await page.reload();
    await waitForEditor(page);
    expect(await activeMode(panel)).toBe(state.mode);
    await setMode(panel, "uv");
    await panel.getByRole("button", { name: "Region visibility" }).click();
    await expect(panel.getByRole("checkbox", { name: "Show all regions" }))
      .not.toBeChecked();
    await expect(panel.getByRole("checkbox", { name: "Show region labels" }))
      .not.toBeChecked();
  }
});

test("UV visibility preferences survive refresh independently", async({ panel, page }) => {
  await setMode(panel, "uv");
  const trigger = panel.getByRole("button", { name: "Region visibility" });
  const labels = panel.getByRole("checkbox", { name: "Show region labels" });
  const showAll = panel.getByRole("checkbox", { name: "Show all regions" });

  for (const state of [
    { all: true, labels: true },
    { all: false, labels: true },
    { all: true, labels: false },
    { all: false, labels: false }
  ]) {
    await trigger.click();
    await showAll.setChecked(state.all);
    await labels.setChecked(state.labels);
    await page.reload();
    await waitForEditor(page);
    await setMode(panel, "uv");
    await trigger.click();
    await expect(showAll).toBeChecked({ checked: state.all });
    await expect(labels).toBeChecked({ checked: state.labels });
    await labels.press("Escape");
  }
});

test.describe("texture preferences", () => {
  test.use({ editor: playground({ importPolicy: "add" }) });

  test("visibility preferences follow the active texture", async({ panel }) => {
    await setMode(panel, "uv");
    const trigger = panel.getByRole("button", { name: "Region visibility" });
    const labels = panel.getByRole("checkbox", { name: "Show region labels" });
    const showAll = panel.getByRole("checkbox", { name: "Show all regions" });
    await trigger.click();
    await showAll.check();
    await labels.check();
    await labels.press("Escape");
    await setMode(panel, "fill");
    await importFile(panel, await pngFile("second.png", { x: 32, y: 32 }, []));
    await expect(panel.getByRole("tab")).toHaveCount(2);
    expect(await activeMode(panel)).toBe("fill");
    await setMode(panel, "uv");
    await trigger.click();
    await expect(showAll).toBeChecked();
    await expect(labels).toBeChecked();
    await showAll.uncheck();
    await labels.press("Escape");
    await panel.getByRole("tab").first().click();
    await trigger.click();
    await expect(showAll).not.toBeChecked();
    await expect(labels).toBeChecked();
  });
});

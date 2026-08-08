// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  textureToScreenPoint,
  clickTexturePixel
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// UV regions carry no pixels; this file resets the shared region set.

// Cycling needs one action per face, so increase the timeout.
test.describe.configure({ timeout: 90_000 });

/**
 * Drag a region with minimal pointer steps.
 */
async function dragRegion(
  page: Page,
  from: { x: number; y: number; },
  to: { x: number; y: number; }
): Promise<void> {
  const start = await textureToScreenPoint(page, from.x, from.y);
  const end = await textureToScreenPoint(page, to.x, to.y);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

interface UvSnapshot {
  selectedRegionId: string | null;
  selectedFace: string | null;
  state: string | null;
  faces: Record<string, { x: number; y: number; }>;
}

function uvPanel(): PixelArtCanvas {
  const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");

  return panel!.canvasManager!;
}

async function resetRegions(
  page: Page
): Promise<void> {
  await page.evaluate(`(${uvPanel.toString()})().uv.clear()`);
}

/**
 * Read selection plus per-face positions.
 */
async function uvSnapshot(
  page: Page
): Promise<UvSnapshot> {
  return page.evaluate(`(() => {
    const uv = (${uvPanel.toString()})().uv;
    const region = uv.selectedRegionId ? uv.get(uv.selectedRegionId) : undefined;
    const faces = {};
    for (const entry of region ? region.facesOf() : []) {
      const rect = "rect" in entry.geometry ? entry.geometry.rect : entry.geometry;
      faces[entry.face ?? "*"] = { x: rect.x, y: rect.y };
    }

    return {
      selectedRegionId: uv.selectedRegionId,
      selectedFace: uv.selectedFace,
      state: region ? region.state : null,
      faces
    };
  })()`) as Promise<UvSnapshot>;
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
  await resetRegions(page);
  await setMode(page, "uv");
  // Regions stay invisible and un-hittable until selected or shown.
  await page.getByRole("button", { name: "Show all" }).click();
  // clear() places the cube at (0,0,16,16).
  await page.getByRole("button", { name: "Create cube", exact: true }).click();
});

test("the ramp preset creates triangular side faces", async({ page }) => {
  await page.getByRole("button", { name: "Create ramp", exact: true }).click();

  const ramp = await page.evaluate(`(() => {
    const regions = Array.from((${uvPanel.toString()})().uv.regions);
    const region = regions[regions.length - 1];
    const data = region.toJSON();

    return {
      state: region.state,
      activeFaces: data.activeFaces,
      left: data.faces.left,
      right: data.faces.right
    };
  })()`) as any;
  expect(ramp.state).toBe("collapsed");
  expect(ramp.activeFaces).toEqual(["back", "left", "right", "top", "bottom"]);
  expect(ramp.left).toMatchObject({ shape: "triangle", corner: "bottom-right" });
  expect(ramp.right).toMatchObject({ shape: "triangle", corner: "bottom-right" });
});

test("a new region is collapsed and has no face", async({ page }) => {
  await clickTexturePixel(page, 8, 8);

  const snapshot = await uvSnapshot(page);
  expect(snapshot.state).toBe("collapsed");
  expect(snapshot.selectedFace).toBeNull();
  expect(snapshot.faces).toEqual({ "*": { x: 0, y: 0 } });
});

test("the toolbar offers only the transition that applies", async({ page }) => {
  const uncollapse = page.getByRole("button", { name: "Uncollapse" });
  const collapse = page.getByRole("button", { name: "Collapse", exact: true });

  // Region exists, but nothing is selected yet.
  await expect(uncollapse).toHaveCount(0);
  await expect(collapse).toHaveCount(0);

  await clickTexturePixel(page, 8, 8);
  await expect(uncollapse).toHaveCount(1);
  await expect(collapse).toHaveCount(0);

  await uncollapse.click();
  await expect(collapse).toHaveCount(1);
  await expect(uncollapse).toHaveCount(0);

  // Clicking empty space clears selection.
  await clickTexturePixel(page, 70, 70);
  await expect(collapse).toHaveCount(0);
  await expect(uncollapse).toHaveCount(0);

  // Deleting the selected region only emits "region-deleted".
  await clickTexturePixel(page, 8, 8);
  await expect(collapse).toHaveCount(1);
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(collapse).toHaveCount(0);
  await expect(uncollapse).toHaveCount(0);
});

test("Show all forces region labels without overwriting their preference", async({ page }) => {
  const labels = page.getByRole("button", { name: "Show region labels" });
  const showAll = page.getByRole("button", { name: "Show all" });

  await expect(labels).toBeDisabled();
  await expect(labels).toHaveAttribute("aria-pressed", "true");
  await expect(labels).toHaveClass(/active/);

  await showAll.click();
  await expect(labels).toBeEnabled();
  await expect(labels).toHaveAttribute("aria-pressed", "false");

  await labels.click();
  await expect(labels).toHaveAttribute("aria-pressed", "true");

  await showAll.click();
  await expect(labels).toBeDisabled();
  await showAll.click();
  await expect(labels).toBeEnabled();
  await expect(labels).toHaveAttribute("aria-pressed", "true");
});

test("uncollapsing stacks six faces on the spot the region already occupied", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await page.getByRole("button", { name: "Uncollapse" }).click();

  const snapshot = await uvSnapshot(page);
  expect(snapshot.state).toBe("uncollapsed");
  expect(snapshot.faces).toEqual({
    front: { x: 0, y: 0 },
    back: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    top: { x: 0, y: 0 },
    bottom: { x: 0, y: 0 }
  });
});

test("clicking the same spot cycles through the stacked faces", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await page.getByRole("button", { name: "Uncollapse" }).click();

  const picked: (string | null)[] = [];
  for (let index = 0; index < 7; index++) {
    await clickTexturePixel(page, 8, 8);
    picked.push((await uvSnapshot(page)).selectedFace);
  }

  expect(picked).toEqual([
    "front", "back", "left", "right", "top", "bottom",
    // wraps
    "front"
  ]);
});

test("dragging moves only the face the press landed on", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await page.getByRole("button", { name: "Uncollapse" }).click();

  // Presses cycle faces; the drag starts on "left".
  await clickTexturePixel(page, 8, 8);
  await clickTexturePixel(page, 8, 8);
  await dragRegion(page, { x: 8, y: 8 }, { x: 40, y: 8 });

  const snapshot = await uvSnapshot(page);
  expect(snapshot.selectedFace).toBe("left");
  expect(snapshot.faces.left).toEqual({ x: 32, y: 0 });
  expect(snapshot.faces.front).toEqual({ x: 0, y: 0 });
  expect(snapshot.faces.back).toEqual({ x: 0, y: 0 });
});

test("collapsing keeps the edited face, and undo brings the discarded ones back", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await page.getByRole("button", { name: "Uncollapse" }).click();
  await dragRegion(page, { x: 8, y: 8 }, { x: 40, y: 8 });

  const moved = await uvSnapshot(page);
  expect(moved.selectedFace).toBe("front");
  expect(moved.faces.front).toEqual({ x: 32, y: 0 });

  // Collapse keeps the edited face.
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  const collapsed = await uvSnapshot(page);
  expect(collapsed.state).toBe("collapsed");
  expect(collapsed.faces).toEqual({ "*": { x: 32, y: 0 } });

  await page.getByRole("button", { name: "Undo" }).click();

  const restored = await uvSnapshot(page);
  expect(restored.state).toBe("uncollapsed");
  expect(restored.faces.front).toEqual({ x: 32, y: 0 });
  expect(restored.faces.back).toEqual(
    { x: 0, y: 0 }
  );
});

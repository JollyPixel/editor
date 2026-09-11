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

async function setRegionState(
  page: Page,
  state: "Stacked" | "Unfolded" | "Free"
): Promise<void> {
  await page.getByRole("button", { name: /^Region state: / }).click();
  await page.getByRole("menuitem", { name: state }).click();
}

interface UvSnapshot {
  selectedRegionId: string | null;
  selectedSlot: string | null;
  state: string | null;
  faces: Record<string, { x: number; y: number; }>;
}

interface RampFaceSnapshot {
  state: string;
  activeFaces: string[];
  left: { shape: string; corner: string; };
  right: { shape: string; corner: string; };
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
    for (const entry of region ? region.slotsOf() : []) {
      const rect = "rect" in entry.geometry ? entry.geometry.rect : entry.geometry;
      faces[entry.slot ?? "*"] = { x: rect.x, y: rect.y };
    }

    return {
      selectedRegionId: uv.selectedRegionId,
      selectedSlot: uv.selectedSlot,
      state: region ? region.state : null,
      faces
    };
  })()`) as Promise<UvSnapshot>;
}

test.beforeEach(async({ page }) => {
  /*
   * Preview meshes live in the 3D runtime; every test in this file either
   * drags a region in front of it or asserts on __uvPreviewMeshCount.
   */
  await gotoDemo(page, undefined, { runtime: true });
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
  })()`) as RampFaceSnapshot;
  expect(ramp.state).toBe("stacked");
  expect(ramp.activeFaces).toEqual(["back", "left", "right", "top", "bottom"]);
  expect(ramp.left).toMatchObject({ shape: "triangle", corner: "bottom-right" });
  expect(ramp.right).toMatchObject({ shape: "triangle", corner: "bottom-right" });
});

test("a new region is stacked and has no face", async({ page }) => {
  await clickTexturePixel(page, 8, 8);

  const snapshot = await uvSnapshot(page);
  expect(snapshot.state).toBe("stacked");
  expect(snapshot.selectedSlot).toBeNull();
  expect(snapshot.faces).toEqual({ "*": { x: 0, y: 0 } });
});

test("the state dropdown appears with a selection and offers the other two states", async({ page }) => {
  const trigger = page.getByRole("button", { name: /^Region state: / });

  // Region exists, but nothing is selected yet.
  await expect(trigger).toHaveCount(0);

  await clickTexturePixel(page, 8, 8);
  await expect(trigger).toHaveAccessibleName("Region state: Stacked");

  await trigger.click();
  await expect(page.getByRole("menuitem")).toHaveText(["Unfolded", "Free"]);

  await page.getByRole("menuitem", { name: "Free" }).click();
  await expect(trigger).toHaveAccessibleName("Region state: Free");
  await trigger.click();
  await expect(page.getByRole("menuitem")).toHaveText(["Stacked", "Unfolded"]);
  await page.keyboard.press("Escape");

  // Clicking empty space clears selection.
  await clickTexturePixel(page, 70, 70);
  await expect(trigger).toHaveCount(0);

  // Deleting the selected region only emits "region-deleted".
  await clickTexturePixel(page, 8, 8);
  await expect(trigger).toHaveCount(1);
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(trigger).toHaveCount(0);
});

test("unfolding lays every face out as a net that drags as one", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await setRegionState(page, "Unfolded");

  const unfolded = await uvSnapshot(page);
  expect(unfolded.state).toBe("unfolded");
  expect(unfolded.selectedSlot).toBeNull();
  expect(unfolded.faces).toEqual({
    front: { x: 0, y: 0 },
    back: { x: 16, y: 0 },
    left: { x: 0, y: 16 },
    right: { x: 16, y: 16 },
    top: { x: 0, y: 32 },
    bottom: { x: 16, y: 32 }
  });

  // Grabbing the "right" cell moves the whole net.
  await dragRegion(page, { x: 20, y: 20 }, { x: 28, y: 24 });

  const moved = await uvSnapshot(page);
  expect(moved.faces).toEqual({
    front: { x: 8, y: 4 },
    back: { x: 24, y: 4 },
    left: { x: 8, y: 20 },
    right: { x: 24, y: 20 },
    top: { x: 8, y: 36 },
    bottom: { x: 24, y: 36 }
  });
});

test("freeing an unfolded region leaves the faces where the net put them", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await setRegionState(page, "Unfolded");
  const unfolded = await uvSnapshot(page);

  await setRegionState(page, "Free");

  const freed = await uvSnapshot(page);
  expect(freed.state).toBe("free");
  expect(freed.faces).toEqual(unfolded.faces);
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

test("freeing stacks six faces on the spot the region already occupied", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await setRegionState(page, "Free");

  const snapshot = await uvSnapshot(page);
  expect(snapshot.state).toBe("free");
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
  await setRegionState(page, "Free");

  const picked: (string | null)[] = [];
  for (let index = 0; index < 7; index++) {
    await clickTexturePixel(page, 8, 8);
    picked.push((await uvSnapshot(page)).selectedSlot);
  }

  expect(picked).toEqual([
    "front", "back", "left", "right", "top", "bottom",
    // wraps
    "front"
  ]);
});

test("dragging moves only the face the press landed on", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await setRegionState(page, "Free");

  // Presses cycle faces; the drag starts on "left".
  await clickTexturePixel(page, 8, 8);
  await clickTexturePixel(page, 8, 8);
  await dragRegion(page, { x: 8, y: 8 }, { x: 40, y: 8 });

  const snapshot = await uvSnapshot(page);
  expect(snapshot.selectedSlot).toBe("left");
  expect(snapshot.faces.left).toEqual({ x: 32, y: 0 });
  expect(snapshot.faces.front).toEqual({ x: 0, y: 0 });
  expect(snapshot.faces.back).toEqual({ x: 0, y: 0 });
});

test("stacking keeps the edited face, and undo brings the discarded ones back", async({ page }) => {
  await clickTexturePixel(page, 8, 8);
  await setRegionState(page, "Free");
  await dragRegion(page, { x: 8, y: 8 }, { x: 40, y: 8 });

  const moved = await uvSnapshot(page);
  expect(moved.selectedSlot).toBe("front");
  expect(moved.faces.front).toEqual({ x: 32, y: 0 });

  // Stack keeps the edited face.
  await setRegionState(page, "Stacked");
  const stacked = await uvSnapshot(page);
  expect(stacked.state).toBe("stacked");
  expect(stacked.faces).toEqual({ "*": { x: 32, y: 0 } });

  await page.getByRole("button", { name: "Undo" }).click();

  const restored = await uvSnapshot(page);
  expect(restored.state).toBe("free");
  expect(restored.faces.front).toEqual({ x: 32, y: 0 });
  expect(restored.faces.back).toEqual(
    { x: 0, y: 0 }
  );
});

async function previewMeshCount(
  page: Page
): Promise<number> {
  // @ts-ignore
  return page.evaluate(() => window.__uvPreviewMeshCount?.() ?? -1);
}

test("each region owns exactly one preview mesh", async({ page }) => {
  // The beforeEach hook already created one cube.
  expect(await previewMeshCount(page)).toBe(1);

  await page.getByRole("button", { name: "Create cube", exact: true }).click();
  expect(await previewMeshCount(page)).toBe(2);

  await page.getByRole("button", { name: "Create ramp", exact: true }).click();
  expect(await previewMeshCount(page)).toBe(3);
});

test("a re-sent create for a known region does not add a second preview mesh", async({ page }) => {
  /*
   * Replays the command a peer echo or a resync delivers. UVMap.restore()
   * used to emit region-created for an id it already held, so the gallery
   * built a second mesh and orphaned the first in the scene.
   */
  const regionId = await page.evaluate(`(() => {
    const region = Array.from((${uvPanel.toString()})().uv.regions)[0];

    return region.id;
  })()`) as string;

  const created = await page.evaluate(`(() => {
    const canvas = (${uvPanel.toString()})();
    const region = canvas.uv.get(${JSON.stringify(regionId)});
    let creations = 0;
    const count = () => {
      creations++;
    };
    canvas.uv.on("region-created", count);
    canvas.applyRemoteCommand({
      action: "uv-region-created",
      metadata: { region: region.toJSON() }
    });
    canvas.uv.off("region-created", count);

    return creations;
  })()`) as number;

  /*
   * The gallery also guards against a duplicate id, so assert the root cause
   * too: without it the leak returns for any other region-created listener.
   */
  expect(created).toBe(0);
  expect(await previewMeshCount(page)).toBe(1);
  expect(await page.evaluate(
    `Array.from((${uvPanel.toString()})().uv.regions).length`
  )).toBe(1);
});

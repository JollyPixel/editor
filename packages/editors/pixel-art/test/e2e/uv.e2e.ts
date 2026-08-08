// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  textureToScreenPoint,
  clickTexturePixel
} from "./utils.ts";

// UV regions carry no pixels, so this file claims no texture slice — but it
// does share the room's region set, hence the reset in beforeEach.

// Cycling needs one action per face, and each action costs a trace snapshot
// over a live WebGL scene — enough to blow the default budget.
test.describe.configure({ timeout: 90_000 });

/**
 * Drags a region without `dragStroke`'s per-pixel interpolation: that exists
 * so paint strokes leave no gaps, and its `steps: distance * 4` would fire
 * 128 pointer moves for the drags below. A region only needs enough moves to
 * register as a drag rather than a click.
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

function uvPanel(): {
  uv: {
    clear(): void;
    selectedRegionId: string | null;
    selectedFace: string | null;
    showAll: boolean;
    get(id: string): {
      state: string;
      facesOf(): { face: string | null; rect: { x: number; y: number; }; }[];
    } | undefined;
  };
} {
  const panel = document.querySelector("pixel-draw-panel") as unknown as {
    canvasManager: ReturnType<typeof uvPanel>;
  };

  return panel.canvasManager;
}

async function resetRegions(
  page: Page
): Promise<void> {
  await page.evaluate(`(${uvPanel.toString()})().uv.clear()`);
}

/**
 * Reads selection plus the selected region's per-face positions, so a test
 * can assert which face actually moved.
 */
async function uvSnapshot(
  page: Page
): Promise<UvSnapshot> {
  return page.evaluate(`(() => {
    const uv = (${uvPanel.toString()})().uv;
    const region = uv.selectedRegionId ? uv.get(uv.selectedRegionId) : undefined;
    const faces = {};
    for (const entry of region ? region.facesOf() : []) {
      faces[entry.face ?? "*"] = { x: entry.rect.x, y: entry.rect.y };
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
  // Regions are invisible (and so un-hittable) until selected or shown.
  await page.getByRole("button", { name: "Show all" }).click();
  // Cascading placement resets with clear(), so this lands at (0,0,16,16).
  await page.getByRole("button", { name: "Create", exact: true }).click();
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

  // A region exists but nothing is selected yet.
  await expect(uncollapse).toHaveCount(0);
  await expect(collapse).toHaveCount(0);

  await clickTexturePixel(page, 8, 8);
  await expect(uncollapse).toHaveCount(1);
  await expect(collapse).toHaveCount(0);

  await uncollapse.click();
  await expect(collapse).toHaveCount(1);
  await expect(uncollapse).toHaveCount(0);

  // Clicking empty space deselects.
  await clickTexturePixel(page, 70, 70);
  await expect(collapse).toHaveCount(0);
  await expect(uncollapse).toHaveCount(0);

  // Deleting the selected region clears the selection without a
  // "selection-changed" event, so the toolbar must follow "region-deleted".
  await clickTexturePixel(page, 8, 8);
  await expect(collapse).toHaveCount(1);
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(collapse).toHaveCount(0);
  await expect(uncollapse).toHaveCount(0);
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

  // Each press advances the cycle, including the press that begins a drag:
  // click (front), click (back), then press-and-drag takes "left".
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

  // The panel collapses onto the face being edited, not the library default.
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

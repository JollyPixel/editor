// Import Third-party Dependencies
import {
  boxesOverlap,
  measureBox,
  measureBoxes,
  type Box
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import type { EditMode } from "../../src/shell/toolbar/EditToolbar.ts";
import type { Cell } from "./support/viewport.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kBlock: Cell = { x: 0, y: 0, z: 0 };
const kViewportWidths = [960, 560];
const kModes: ToolbarMode[] = [
  {
    mode: "paint",
    enter: async() => undefined
  },
  {
    mode: "select",
    enter: (map) => map.toolbar.selectButton.click()
  },
  {
    mode: "place",
    enter: async(map) => {
      await map.world.seed([{ ...kBlock, blockId: 1 }]);
      await map.viewport.pinCamera();
      await map.selectConnected(kBlock);
    }
  }
];

interface ToolbarMode {
  mode: EditMode;
  enter: (map: VoxelMapPage) => Promise<unknown>;
}

interface RailLayout {
  overlaps: number;
  outside: number;
  blankRows: number;
}

function countBlankRows(
  rail: Box,
  items: Box[]
): number {
  const rowHeight = Math.min(...items.map((box) => box.height));
  const railBottom = rail.y + rail.height;
  const spans = [
    ...items.map((box) => [box.y, box.y + box.height]),
    [railBottom, railBottom]
  ].sort(([a], [b]) => a - b);

  let blankRows = 0;
  let covered = rail.y;
  for (const [top, bottom] of spans) {
    if (top - covered >= rowHeight) {
      blankRows++;
    }
    covered = Math.max(covered, bottom);
  }

  return blankRows;
}

async function railLayout(
  map: VoxelMapPage
): Promise<RailLayout> {
  const viewport = await measureBox(map.page.locator("#game-container"));
  const rail = await measureBox(map.toolbar.rail);
  const buttons = await measureBoxes(map.toolbar.railButtons);
  const captions = await measureBoxes(map.toolbar.railCaptions);
  const overlaps = buttons.filter(
    (box, index) => buttons.slice(index + 1).some(
      (other) => boxesOverlap(box, other)
    )
  );
  const outside = buttons.filter(
    (box) => box.x < viewport.x ||
      box.x + box.width > viewport.x + viewport.width
  );

  return {
    overlaps: overlaps.length,
    outside: outside.length,
    blankRows: countBlankRows(rail, [...buttons, ...captions])
  };
}

for (const width of kViewportWidths) {
  for (const { mode, enter } of kModes) {
    test(`the ${mode} toolbar wraps cleanly in a ${width}px window`, async({ map, page }) => {
      await enter(map);
      await expect(map.toolbar.root).toHaveAttribute("mode", mode);
      await page.setViewportSize({
        width,
        height: page.viewportSize()!.height
      });
      await expect(map.toolbar.railButtons.first()).toBeVisible();

      await expect.poll(() => railLayout(map)).toEqual({
        overlaps: 0,
        outside: 0,
        blankRows: 0
      });
    });
  }
}

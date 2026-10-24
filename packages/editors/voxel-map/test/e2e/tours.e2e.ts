// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { LanternElement } from "@jolly-pixel/lantern/element";

// Import Internal Dependencies
import {
  test,
  expect,
  EDITOR_OPTIONS
} from "./fixtures.ts";
import type { VoxelMapPage } from "./support/voxelMap.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

interface TourWalk {
  id: string;
  steps: string[];
  prepare?: (map: VoxelMapPage) => Promise<void>;
  actions?: Record<string, (map: VoxelMapPage) => Promise<void>>;
}

const kWalks: TourWalk[] = [
  {
    id: "voxel-map.basics",
    steps: [
      "welcome", "camera", "block-library", "orientation", "building",
      "brush", "tools", "panes", "console", "replay"
    ]
  },
  {
    id: "voxel-map.first-block",
    steps: ["welcome", "texture", "paint", "add-block", "faces", "place", "replay"],
    actions: {
      paint: (map) => map.texture.clickTexel({ x: 16, y: 80 }),
      "add-block": async(map) => {
        await map.blocks.library.addButton.click();
        await map.blockDialog("New Block").createButton.click();
      },
      place: async(map) => {
        await map.viewport.pinCamera();
        await map.viewport.click(kOrigin);
      }
    }
  },
  {
    id: "voxel-map.painting",
    steps: [
      "welcome", "modes", "brush", "colors", "select",
      "navigation", "view-options", "file", "normal-map", "replay"
    ]
  },
  {
    id: "voxel-map.uv-blocksets",
    steps: [
      "welcome", "tabs", "add", "line-tabs", "uv-tool",
      "move", "states", "rotate", "edit-block", "library", "replay"
    ]
  },
  {
    id: "voxel-map.materials",
    steps: [
      "welcome", "library", "create", "pick", "apply",
      "surface", "emission", "lighting", "effects", "replay"
    ],
    actions: {
      pick: (map) => map.materials.newButton.click()
    }
  },
  {
    id: "voxel-map.layers",
    steps: ["welcome", "tree", "add", "visibility", "menu", "inspector", "objects", "replay"]
  },
  {
    id: "voxel-map.templates",
    steps: [
      "welcome", "select-modes", "clipboard", "lift", "placement",
      "save-template", "place-template", "edit-template", "replay"
    ],
    prepare: async(map) => {
      await map.world.seed([kOrigin, { ...kOrigin, x: 1 }].map((cell) => {
        return {
          ...cell,
          blockId: 1
        };
      }));
      await map.panes.open("Layers");
      await map.templates.saveLayer();
    },
    actions: {
      lift: async(map) => {
        await map.page.evaluate(() => {
          window.voxelMapEditor!.editing.state.tool.selectMode = "connected";
        });
        await map.viewport.pinCamera();
        await map.viewport.click(kOrigin);
      }
    }
  }
];

function nextFrame(
  page: Page
): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}

function currentStep(
  page: Page
): Promise<string | null> {
  return page.evaluate(() => {
    const run = document.querySelector<LanternElement>("jolly-lantern")?.run;

    return run?.state === "running" ? run.step.id : null;
  });
}

test.use({
  editor: {
    ...EDITOR_OPTIONS,
    debug: "host.lantern"
  }
});

for (const walk of kWalks) {
  test(`every step of ${walk.id} finds its target`, async({ page, map, commands }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("host.lantern")) {
        warnings.push(message.text());
      }
    });
    const card = page.locator("jolly-lantern .card");
    const shown: string[] = [];

    await walk.prepare?.(map);
    await commands.open();
    await commands.prompt.fill(`/tour.start ${walk.id}`);
    await commands.prompt.press("Enter");
    await expect(card).toBeVisible();
    while (await card.count() > 0) {
      await nextFrame(page);
      await expect(card).not.toHaveAttribute("data-seeking");
      const step = await currentStep(page);
      if (step === null) {
        break;
      }
      shown.push(step);

      const action = walk.actions?.[step];
      if (action === undefined) {
        await card.locator(".next").click();
      }
      else {
        await action(map);
      }
      await expect.poll(() => currentStep(page)).not.toBe(step);
    }

    expect(shown).toEqual(walk.steps);
    expect(warnings).toEqual([]);
  });
}

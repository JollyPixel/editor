// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect,
  demo
} from "./fixtures.ts";
import {
  clickTexturePixel,
  dragStroke,
  setMode,
  type TexturePoint
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// CONSTANTS
const kOrigin = { x: 0, y: 0 };
const kCubeCell = { x: 8, y: 8 };

interface UvSnapshot {
  selectedSlot: string | null;
  state: string | null;
  faces: Record<string, TexturePoint>;
}

function uvSnapshot(
  panel: Locator
): Promise<UvSnapshot> {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { uv } = element.canvasManager!;
    const region = uv.selectedRegionId ? uv.get(uv.selectedRegionId) : undefined;
    const faces: Record<string, { x: number; y: number; }> = {};
    for (const entry of region?.slotsOf() ?? []) {
      const rect = "rect" in entry.geometry ? entry.geometry.rect : entry.geometry;
      faces[entry.slot ?? "*"] = { x: rect.x, y: rect.y };
    }

    return {
      selectedSlot: uv.selectedSlot,
      state: region?.state ?? null,
      faces
    };
  });
}

async function setRegionState(
  panel: Locator,
  state: "Stacked" | "Unfolded" | "Free"
): Promise<void> {
  await panel.getByRole("button", { name: /^Region state: / }).click();
  await panel.getByRole("menuitem", { name: state }).click();
}

function uvRotations(
  panel: Locator
): Promise<Record<string, number>> {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { uv } = element.canvasManager!;
    const region = uv.selectedRegionId ? uv.get(uv.selectedRegionId) : undefined;
    const rotations: Record<string, number> = {};
    for (const slot of region?.activeSlots ?? []) {
      rotations[slot] = region!.geometryFor(slot).rotation ?? 0;
    }

    return rotations;
  });
}

function sixFaces<TValue>(
  at: (index: number) => TValue
): Record<string, TValue> {
  const slots = ["front", "back", "left", "right", "top", "bottom"];

  return Object.fromEntries(slots.map((slot, index) => [slot, at(index)]));
}

test.beforeEach(async({ panel }) => {
  await setMode(panel, "uv");
  await panel.getByRole("button", { name: "Show all" }).click();
  await panel.getByRole("button", { name: "Create cube", exact: true }).click();
});

test("the state menu follows the selection and lists the other two states", async({ panel }) => {
  const trigger = panel.getByRole("button", { name: /^Region state: / });
  await expect(trigger).toHaveCount(0);

  await clickTexturePixel(panel, kCubeCell);
  await expect(trigger).toHaveAccessibleName("Region state: Stacked");
  expect(await uvSnapshot(panel)).toEqual({
    selectedSlot: null,
    state: "stacked",
    faces: { "*": kOrigin }
  });

  await trigger.click();
  await expect(panel.getByRole("menuitem")).toHaveText(["Unfolded", "Free"]);
  await panel.getByRole("menuitem", { name: "Free" }).click();
  await expect(trigger).toHaveAccessibleName("Region state: Free");
  await trigger.click();
  await expect(panel.getByRole("menuitem")).toHaveText(["Stacked", "Unfolded"]);
  await panel.page().keyboard.press("Escape");

  await clickTexturePixel(panel, { x: 70, y: 70 });
  await expect(trigger).toHaveCount(0);

  await clickTexturePixel(panel, kCubeCell);
  await panel.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(trigger).toHaveCount(0);
});

test("unfolding lays the faces out as a net that drags as one and stays put when freed", async({ panel }) => {
  await clickTexturePixel(panel, kCubeCell);
  await setRegionState(panel, "Unfolded");
  function net(
    dx: number,
    dy: number
  ) {
    return sixFaces((index) => {
      return {
        x: ((index % 2) * 16) + dx,
        y: (Math.floor(index / 2) * 16) + dy
      };
    });
  }
  expect(await uvSnapshot(panel)).toEqual({
    selectedSlot: null,
    state: "unfolded",
    faces: net(0, 0)
  });

  await dragStroke(panel, [
    { x: 20, y: 20 },
    { x: 28, y: 24 }
  ], { steps: 1 });
  expect((await uvSnapshot(panel)).faces).toEqual(net(8, 4));

  await setRegionState(panel, "Free");
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "free",
    faces: net(8, 4)
  });
});

test("freeing stacks six faces in place and clicks cycle through them", async({ panel }) => {
  await clickTexturePixel(panel, kCubeCell);
  await setRegionState(panel, "Free");
  expect((await uvSnapshot(panel)).faces).toEqual(sixFaces(() => kOrigin));

  const picked: (string | null)[] = [];
  for (let index = 0; index < 7; index++) {
    await clickTexturePixel(panel, kCubeCell);
    picked.push((await uvSnapshot(panel)).selectedSlot);
  }

  expect(picked).toEqual(["front", "back", "left", "right", "top", "bottom", "front"]);
});

test("dragging a free region moves only the face under the press", async({ panel }) => {
  await clickTexturePixel(panel, kCubeCell);
  await setRegionState(panel, "Free");
  await clickTexturePixel(panel, kCubeCell);
  await clickTexturePixel(panel, kCubeCell);

  await dragStroke(panel, [kCubeCell, { x: 40, y: 8 }], { steps: 1 });

  const { selectedSlot, faces } = await uvSnapshot(panel);
  expect(selectedSlot).toBe("left");
  expect(faces).toMatchObject({
    left: { x: 32, y: 0 },
    front: kOrigin,
    back: kOrigin
  });
});

test("stacking keeps the edited face, and undo restores the free faces", async({ panel }) => {
  await clickTexturePixel(panel, kCubeCell);
  await setRegionState(panel, "Free");
  await dragStroke(panel, [kCubeCell, { x: 40, y: 8 }], { steps: 1 });
  expect(await uvSnapshot(panel)).toMatchObject({
    selectedSlot: "front",
    faces: { front: { x: 32, y: 0 } }
  });

  await setRegionState(panel, "Stacked");
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "stacked",
    faces: { "*": { x: 32, y: 0 } }
  });

  await panel.getByRole("button", { name: "Undo" }).click();
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "free",
    faces: {
      front: { x: 32, y: 0 },
      back: kOrigin
    }
  });
});

test("rotation turns the whole stacked region, and only the selected face once freed", async({ panel }) => {
  const clockwise = panel.getByRole("button", { name: /^Rotate .* clockwise$/ });
  await expect(clockwise).toHaveCount(0);

  await clickTexturePixel(panel, kCubeCell);
  await expect(clockwise).toHaveAccessibleName("Rotate region clockwise");
  await clockwise.click();
  expect(await uvRotations(panel)).toEqual(sixFaces(() => 1));
  await expect(panel.locator("[part=\"uv-orientation-marker\"]")).toHaveCount(1);

  await panel.getByRole("button", { name: "Rotate region counter-clockwise" }).click();
  expect(await uvRotations(panel)).toEqual(sixFaces(() => 0));

  await setRegionState(panel, "Free");
  await expect(clockwise).toHaveAccessibleName("Rotate slot \"front\" clockwise");
  await panel.page().keyboard.press("r");
  expect(await uvRotations(panel)).toMatchObject({
    front: 1,
    back: 0
  });

  await panel.getByRole("button", { name: "Undo" }).click();
  expect(await uvRotations(panel)).toMatchObject({ front: 0 });
});

test("Create ramp adds a region with triangular sides and a true-length slope", async({ panel }) => {
  await panel.getByRole("button", { name: "Create ramp", exact: true }).click();

  const ramp = await panel.evaluate((element: PixelDrawPanel) => {
    const region = Array.from(element.canvasManager!.uv.regions).at(-1)!;
    const { activeFaces, faces } = region.toJSON();

    return {
      state: region.state,
      activeFaces,
      left: faces?.left,
      right: faces?.right,
      top: faces?.top
    };
  });
  expect(ramp).toMatchObject({
    state: "stacked",
    activeFaces: ["back", "left", "right", "top", "bottom"],
    left: { shape: "triangle", corner: "bottom-right" },
    right: { shape: "triangle", corner: "bottom-right" },
    top: { width: 16, height: 23 }
  });
});

test("Show all and region labels toggle independently", async({ panel }) => {
  const labels = panel.getByRole("button", { name: "Show region labels" });
  const showAll = panel.getByRole("button", { name: "Show all" });
  await expect(showAll).toHaveAttribute("aria-pressed", "true");
  await expect(labels).toHaveAttribute("aria-pressed", "false");

  await labels.click();
  await expect(labels).toHaveAttribute("aria-pressed", "true");
  await expect(showAll).toHaveAttribute("aria-pressed", "true");

  await showAll.click();
  await expect(showAll).toHaveAttribute("aria-pressed", "false");
  await expect(labels).toBeEnabled();
  await expect(labels).toHaveAttribute("aria-pressed", "true");
});

test.describe("3D preview", () => {
  test.use({ editor: demo({ runtime: true }) });

  function previewMeshCount(
    panel: Locator
  ): Promise<number> {
    return panel.page().evaluate(
      () => window.pixelArtDemo?.preview?.scene.meshCount ?? -1
    );
  }

  test("each region owns exactly one preview mesh", async({ panel }) => {
    await expect.poll(() => previewMeshCount(panel)).toBe(1);

    await panel.getByRole("button", { name: "Create cube", exact: true }).click();
    await expect.poll(() => previewMeshCount(panel)).toBe(2);

    await panel.getByRole("button", { name: "Create ramp", exact: true }).click();
    await expect.poll(() => previewMeshCount(panel)).toBe(3);
  });

  test("a re-sent create for a known region adds no region and no mesh", async({ panel }) => {
    const created = await panel.evaluate((element: PixelDrawPanel) => {
      const canvas = element.canvasManager!;
      const [region] = canvas.uv.regions;
      let creations = 0;
      function count() {
        creations++;
      }
      canvas.uv.on("region-created", count);
      canvas.applyRemoteCommand({
        action: "uv-region-created",
        metadata: { region: region.toJSON() }
      });
      canvas.uv.off("region-created", count);

      return {
        creations,
        regions: Array.from(canvas.uv.regions).length
      };
    });

    expect(created).toEqual({ creations: 0, regions: 1 });
    expect(await previewMeshCount(panel)).toBe(1);
  });
});

// Import Internal Dependencies
import {
  test,
  expect,
  playground
} from "./fixtures.ts";
import type { TexturePoint } from "./support/canvas.ts";
import type { PixelArtPanel } from "./support/panel.ts";
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
  panel: PixelArtPanel
): Promise<UvSnapshot> {
  return panel.root.evaluate((element: PixelDrawPanel) => {
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

function uvRotations(
  panel: PixelArtPanel
): Promise<Record<string, number>> {
  return panel.root.evaluate((element: PixelDrawPanel) => {
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
  await panel.modes.select("uv");
  await panel.visibility.apply({ all: true });
  await panel.uv.createCube.click();
});

test("the state menu follows the selection and lists the other two states", async({ panel, page }) => {
  const trigger = panel.uv.stateMenu;
  const menuItems = panel.root.getByRole("menuitem");
  await expect(trigger).toHaveCount(0);

  await panel.canvas.click(kCubeCell);
  await expect(trigger).toHaveAccessibleName("Region state: Stacked");
  expect(await uvSnapshot(panel)).toEqual({
    selectedSlot: null,
    state: "stacked",
    faces: { "*": kOrigin }
  });

  await trigger.hover();
  await expect(menuItems).toHaveText(["Unfolded", "Free"]);
  await page.mouse.move(0, 0);
  await expect(menuItems).toHaveCount(0);
  await trigger.hover();
  await panel.root.getByRole("menuitem", { name: "Free" }).click();
  await expect(trigger).toHaveAccessibleName("Region state: Free");
  await trigger.click();
  await expect(menuItems).toHaveText(["Stacked", "Unfolded"]);
  await page.keyboard.press("Escape");

  await panel.canvas.click({ x: 70, y: 70 });
  await expect(trigger).toHaveCount(0);

  await panel.canvas.click(kCubeCell);
  await panel.root.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(trigger).toHaveCount(0);
});

test("unfolding lays the faces out as a net that drags as one and stays put when freed", async({ panel }) => {
  await panel.canvas.click(kCubeCell);
  await panel.uv.changeState("Unfolded");
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

  await panel.canvas.drag([
    { x: 20, y: 20 },
    { x: 28, y: 24 }
  ], { steps: 1 });
  expect((await uvSnapshot(panel)).faces).toEqual(net(8, 4));

  await panel.uv.changeState("Free");
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "free",
    faces: net(8, 4)
  });
});

test("freeing stacks six faces in place and clicks cycle through them", async({ panel }) => {
  await panel.canvas.click(kCubeCell);
  await panel.uv.changeState("Free");
  expect((await uvSnapshot(panel)).faces).toEqual(sixFaces(() => kOrigin));

  const picked: (string | null)[] = [];
  for (let index = 0; index < 7; index++) {
    await panel.canvas.click(kCubeCell);
    picked.push((await uvSnapshot(panel)).selectedSlot);
  }

  expect(picked).toEqual(["front", "back", "left", "right", "top", "bottom", "front"]);
});

test("dragging a free region moves only the face under the press", async({ panel }) => {
  await panel.canvas.click(kCubeCell);
  await panel.uv.changeState("Free");
  await panel.canvas.click(kCubeCell);
  await panel.canvas.click(kCubeCell);

  await panel.canvas.drag([kCubeCell, { x: 40, y: 8 }], { steps: 1 });

  const { selectedSlot, faces } = await uvSnapshot(panel);
  expect(selectedSlot).toBe("left");
  expect(faces).toMatchObject({
    left: { x: 32, y: 0 },
    front: kOrigin,
    back: kOrigin
  });
});

test("stacking keeps the edited face, and undo restores the free faces", async({ panel }) => {
  await panel.canvas.click(kCubeCell);
  await panel.uv.changeState("Free");
  await panel.canvas.drag([kCubeCell, { x: 40, y: 8 }], { steps: 1 });
  expect(await uvSnapshot(panel)).toMatchObject({
    selectedSlot: "front",
    faces: { front: { x: 32, y: 0 } }
  });

  await panel.uv.changeState("Stacked");
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "stacked",
    faces: { "*": { x: 32, y: 0 } }
  });

  await panel.undoButton.click();
  expect(await uvSnapshot(panel)).toMatchObject({
    state: "free",
    faces: {
      front: { x: 32, y: 0 },
      back: kOrigin
    }
  });
});

test("rotation turns the whole stacked region, and only the selected face once freed", async({
  panel,
  page
}) => {
  const clockwise = panel.uv.rotateClockwise;
  await expect(clockwise).toHaveCount(0);

  await panel.canvas.click(kCubeCell);
  await expect(clockwise).toHaveAccessibleName("Rotate region clockwise");
  await clockwise.click();
  expect(await uvRotations(panel)).toEqual(sixFaces(() => 1));
  await expect(panel.root.locator("[part=\"uv-orientation-marker\"]")).toHaveCount(1);

  await panel.root.getByRole("button", { name: "Rotate region counter-clockwise" }).click();
  expect(await uvRotations(panel)).toEqual(sixFaces(() => 0));

  await panel.uv.changeState("Free");
  await expect(clockwise).toHaveAccessibleName("Rotate slot \"front\" clockwise");
  await page.keyboard.press("r");
  expect(await uvRotations(panel)).toMatchObject({
    front: 1,
    back: 0
  });

  await panel.undoButton.click();
  expect(await uvRotations(panel)).toMatchObject({ front: 0 });
});

test("Create ramp adds a region with triangular sides and a true-length slope", async({ panel }) => {
  await panel.uv.createRamp.click();

  const ramp = await panel.root.evaluate((element: PixelDrawPanel) => {
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
  const { trigger, menu } = panel.visibility;
  await trigger.focus();
  await trigger.press("Enter");
  const labels = menu.getByRole("checkbox", { name: "Show region labels" });
  const showAll = menu.getByRole("checkbox", { name: "Show all regions" });
  await expect(showAll).toBeChecked();
  await expect(labels).not.toBeChecked();

  await labels.check();
  await expect(labels).toBeChecked();
  await expect(showAll).toBeChecked();

  await showAll.uncheck();
  await expect(showAll).not.toBeChecked();
  await expect(labels).toBeChecked();
  await expect(menu).toBeVisible();
  await showAll.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(labels).toBeChecked();
  await expect(showAll).not.toBeChecked();
  expect(await panel.root.evaluate((element: PixelDrawPanel) => {
    return {
      all: element.canvasManager!.uv.showAll,
      labels: element.canvasManager!.uv.showRegionLabels
    };
  })).toEqual({ all: false, labels: true });
});

test.describe("3D preview", () => {
  test.use({ editor: playground({ runtime: true }) });

  function previewMeshCount(
    panel: PixelArtPanel
  ): Promise<number> {
    return panel.page.evaluate(
      () => window.pixelArtEditor?.preview?.scene.meshCount ?? -1
    );
  }

  test("each region owns exactly one preview mesh", async({ panel }) => {
    await expect.poll(() => previewMeshCount(panel)).toBe(1);

    await panel.uv.createCube.click();
    await expect.poll(() => previewMeshCount(panel)).toBe(2);

    await panel.uv.createRamp.click();
    await expect.poll(() => previewMeshCount(panel)).toBe(3);
  });
});

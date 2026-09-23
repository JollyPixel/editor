// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { Vector3Like } from "three";
import { treeRow, pressAt } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { addNode } from "./support/hierarchy.ts";
import {
  blockSummary,
  clickBlock,
  gizmoHandlePoints,
  selectedBlock
} from "./support/scene.ts";

type Mode = "Pos" | "Angle" | "Size" | "Pivot" | "Scale";

async function enterAxes(
  page: Page,
  value: Partial<Vector3Like>
): Promise<void> {
  for (const [axis, component] of Object.entries(value)) {
    const field = page.getByRole("textbox", { name: axis.toUpperCase() });
    await field.fill(String(component));
    await field.press("Enter");
  }
}

async function chooseMode(
  page: Page,
  mode: Mode
): Promise<void> {
  await page.getByRole("radio", { name: mode }).check();
}

async function expectAxes(
  page: Page,
  value: Vector3Like
): Promise<void> {
  await expect(page.getByRole("textbox", { name: "X" })).toHaveValue(value.x.toFixed(2));
  await expect(page.getByRole("textbox", { name: "Y" })).toHaveValue(value.y.toFixed(2));
  await expect(page.getByRole("textbox", { name: "Z" })).toHaveValue(value.z.toFixed(2));
}

test.beforeEach(async({ page }) => {
  await treeRow(page, "Block").click();
});

test("each mode edits its own component of the selected block", async({ page }) => {
  await enterAxes(page, { x: 1 });

  await chooseMode(page, "Angle");
  await enterAxes(page, { y: 90 });

  await chooseMode(page, "Size");
  await enterAxes(page, { x: 2 });

  await chooseMode(page, "Scale");
  await enterAxes(page, { z: 0.5 });

  await chooseMode(page, "Pivot");
  await enterAxes(page, { y: -0.5 });

  expect(await blockSummary(page, "Block")).toEqual({
    position: { x: 1, y: 0, z: 0 },
    worldPosition: { x: 1, y: 0, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
    size: { x: 2, y: 1, z: 1 },
    scale: { x: 1, y: 1, z: 0.5 },
    pivotOffset: { x: 0, y: -0.5, z: 0 }
  });

  await chooseMode(page, "Pos");
  await expectAxes(page, { x: 1, y: 0, z: 0 });
});

test("the space toggle only applies to position, angle and pivot", async({ page }) => {
  const space = page.getByRole("radiogroup", { name: "Transform space" });

  for (const mode of ["Pos", "Angle", "Pivot"] as const) {
    await chooseMode(page, mode);
    await expect(space.getByRole("radio", { name: "Global" })).toBeEnabled();
  }
  for (const mode of ["Size", "Scale"] as const) {
    await chooseMode(page, mode);
    await expect(space.getByRole("radio", { name: "Global" })).toBeDisabled();
  }
});

test("a child reads and writes its position in the active space", async({ page }) => {
  await enterAxes(page, { x: 2 });
  await chooseMode(page, "Angle");
  await enterAxes(page, { y: 90 });

  await addNode(page, "Block", "Arm");

  await chooseMode(page, "Pos");
  await enterAxes(page, { x: 1 });
  await expectAxes(page, { x: 1, y: 0, z: 0 });

  await page.getByRole("radio", { name: "Global" }).check();
  await expectAxes(page, { x: 2, y: 0, z: -1 });

  await enterAxes(page, { z: -3 });
  expect(await blockSummary(page, "Arm")).toMatchObject({
    position: { x: 3, y: 0, z: 0 },
    worldPosition: { x: 2, y: 0, z: -3 }
  });
});

test("clicking the viewport selects a block, and empty space clears it", async({ page }) => {
  await addNode(page, "Block", "Arm", { asChild: false });
  await enterAxes(page, { x: -2, y: 1 });
  await treeRow(page, "Block").click();

  await test.step("a block", async() => {
    await clickBlock(page, "Arm");

    await expect(treeRow(page, "Arm")).toHaveAttribute("aria-selected", "true");
    await expectAxes(page, { x: -2, y: 1, z: 0 });
    expect(await selectedBlock(page)).toBe("Arm");
  });

  await test.step("empty space", async() => {
    const canvas = await page.locator("#three-renderer canvas").boundingBox();
    if (canvas === null) {
      throw new Error("The viewport canvas is not visible.");
    }

    await pressAt(page, [
      {
        x: canvas.x + 8,
        y: canvas.y + 8
      }
    ], { settle: nextFrames });

    await expect(treeRow(page, "Arm")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("textbox", { name: "X" })).toBeDisabled();
    expect(await selectedBlock(page)).toBeNull();
  });
});

test("dragging a gizmo arrow moves the block along that axis only", async({ page }) => {
  await chooseMode(page, "Pos");

  await pressAt(page, await gizmoHandlePoints(page, "X"), {
    settle: nextFrames
  });

  const moved = await blockSummary(page, "Block");
  if (moved === null) {
    throw new Error("The dragged block is missing from the document.");
  }

  expect(moved.position.x).toBeGreaterThan(0.1);
  expect(moved.position).toMatchObject({ y: 0, z: 0 });
  await expect(page.getByRole("textbox", { name: "X" }))
    .toHaveValue(moved.position.x.toFixed(2));
});

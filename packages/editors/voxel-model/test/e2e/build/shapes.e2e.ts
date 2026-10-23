// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  dialog,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test, expect } from "../fixtures.ts";
import {
  addNode,
  hierarchyAction
} from "../support/hierarchy.ts";
import { numberField } from "../support/fields.ts";
import { resolveEditor } from "../support/scene.ts";
import { historyButton } from "../support/history.ts";

function shapeField(
  page: Page
): Locator {
  return page.getByTitle("Shape").getByRole("combobox");
}

async function readFaceSlots(
  page: Page,
  name: string
): Promise<string[]> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, blockName) => {
    const block = [...editing.blocks.values()].find((candidate) => candidate.name === blockName);

    return block === undefined ? [] : Object.keys(block.faces);
  }, name);
}

async function readStoredShape(
  page: Page,
  name: string
): Promise<unknown> {
  const editor = await resolveEditor(page);

  return editor.evaluate(({ editing }, blockName) => {
    const block = [...editing.blocks.values()].find((candidate) => candidate.name === blockName);

    return block === undefined ? null : editing.document.tree.block(block.uuid)?.shape ?? null;
  }, name);
}

function regionLabel(
  page: Page,
  label: string
): Locator {
  return page.getByRole("img").filter({ hasText: label });
}

test("a plane added from a row menu gets a single top face region", async({ page }) => {
  await addNode(page, "Block", "Floor", { under: "Block", shape: "Plane" });

  await expect(treeRow(page, "Floor")).toHaveAttribute("aria-selected", "true");
  await expect(shapeField(page).locator("option:checked")).toHaveText("Plane");
  await expect(regionLabel(page, "(Floor)top")).toBeVisible();
  await expect(regionLabel(page, "(Floor)front")).toHaveCount(0);
});

test("the New Block dialog offers the shape picked last", async({ page }) => {
  await addNode(page, "Block", "Floor", { shape: "Plane" });

  await hierarchyAction(page, "Add Block").click();
  const form = dialog(page, "New Block");
  const plane = form.getByRole("radio", { name: "Plane", exact: true });
  await expect(plane).toHaveAttribute("aria-checked", "true");
  await form.getByRole("button", { name: "Cancel" }).click();
});

test("a cylinder from the Add Block menu takes its Sides from the Shape section", async({ page }) => {
  await addNode(page, "Block", "Pillar", { under: "Block", shape: "Cylinder" });
  const shape = page.locator("jolly-model-editor-shape");
  await expect(shapeField(page).locator("option:checked")).toHaveText("Cylinder");
  await expect(numberField(shape, "Sides")).toHaveValue("8");
  expect(await readFaceSlots(page, "Pillar")).toHaveLength(8 + 2);

  await numberField(shape, "Sides").fill("5");
  await numberField(shape, "Sides").press("Enter");
  await expect.poll(() => readFaceSlots(page, "Pillar")).toHaveLength(5 + 2);

  const undo = historyButton(page, "Undo");
  await expect(undo).toHaveAttribute("title", "Undo Set shape of Pillar (Ctrl+Z)");
  await undo.getByRole("button").click();
  await expect(numberField(shape, "Sides")).toHaveValue("8");
  expect(await readFaceSlots(page, "Pillar")).toHaveLength(8 + 2);
});

test("a torus keeps its segment faces while its ring sides and thickness change", async({ page }) => {
  await addNode(page, "Block", "Halo", { shape: "Torus" });
  const shape = page.locator("jolly-model-editor-shape");
  await expect(shapeField(page).locator("option:checked")).toHaveText("Torus");

  await numberField(shape, "Ring sides").fill("10");
  await numberField(shape, "Ring sides").press("Enter");
  await numberField(shape, "Thickness").fill("0.6");
  await numberField(shape, "Thickness").press("Enter");

  await expect.poll(() => readStoredShape(page, "Halo")).toEqual({
    type: "torus",
    sides: 8,
    ringSides: 10,
    thickness: 0.6
  });
  expect(await readFaceSlots(page, "Halo")).toHaveLength(8);
});

test("the Shape select reshapes the selected block as one undoable step", async({ page }) => {
  await treeRow(page, "Block").click();
  await expect(regionLabel(page, "(Block)front")).toBeVisible();

  await shapeField(page).selectOption({ label: "Plane" });
  await expect(regionLabel(page, "(Block)top")).toBeVisible();
  await expect(regionLabel(page, "(Block)front")).toHaveCount(0);

  await page.keyboard.press("Control+z");
  await expect(shapeField(page).locator("option:checked")).toHaveText("Box");
  await expect(regionLabel(page, "(Block)front")).toBeVisible();
});

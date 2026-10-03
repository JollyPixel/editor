// Import Third-party Dependencies
import {
  dialog,
  treeRow
} from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  addNode,
  materialFooter,
  materialMenu,
  materialRow,
  materialRowMenu,
  materialTab,
  materialTool,
  newMaterial,
  openMaterial,
  openMaterialTab
} from "./support/hierarchy.ts";
import {
  blockSurface,
  materialOutline,
  materialUses,
  selectedBlock
} from "./support/scene.ts";

test("a block's swatch opens the Material tab, where a new material goes to it", async({ page }) => {
  await openMaterial(page, "Block");

  await newMaterial(page, "Glass");

  await expect.poll(() => blockSurface(page, "Block", "document"))
    .toMatchObject({ opacity: 0.45 });
  await expect(treeRow(page, "Block").getByRole("button", { name: "Material: Glass" }))
    .toBeVisible();
  await expect(materialRow(page, "Glass")).toContainText("1");
  await expect(materialRow(page, "Block")).toHaveAttribute("aria-selected", "true");
});

test("a slider drag previews on the block and is stored on release", async({ page }) => {
  const library = await openMaterial(page, "Block");
  await newMaterial(page, "Material");
  const box = (await library.getByRole("slider", { name: "Metalness" }).boundingBox())!;
  const y = box.y + (box.height / 2);

  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 0.8), y, { steps: 4 });

  await expect.poll(async() => (await blockSurface(page, "Block"))?.metalness ?? 0)
    .toBeGreaterThan(0.5);
  expect((await blockSurface(page, "Block", "document"))?.metalness).toBe(0);

  await page.mouse.up();

  await expect.poll(async() => (await blockSurface(page, "Block", "document"))?.metalness ?? 0)
    .toBeGreaterThan(0.5);
});

test("the footer applies the material to the selected block and removes it", async({ page }) => {
  await openMaterial(page, "Block");
  await newMaterial(page, "Metal");
  await addNode(page, "Block", "Arm");
  await treeRow(page, "Arm").click();
  const footer = materialFooter(page);

  await footer.getByRole("button", { name: "Apply to Arm" }).click();
  await expect.poll(() => materialUses(page)).toEqual([["Metal", 2]]);
  expect(await blockSurface(page, "Arm")).toMatchObject({ metalness: 0.8 });

  await footer.getByRole("button", { name: "Remove from Arm" }).click();
  await expect.poll(() => materialUses(page)).toEqual([["Metal", 1]]);
  expect(await blockSurface(page, "Arm")).toBeNull();
  await expect(footer.getByRole("button", { name: "Apply to Arm" })).toBeVisible();
});

test("a material lists the blocks using it, which follow the selection both ways", async({ page }) => {
  await openMaterial(page, "Block");
  await newMaterial(page, "Metal");
  await addNode(page, "Block", "Arm");
  await treeRow(page, "Arm").click();
  await materialFooter(page).getByRole("button", { name: "Apply to Arm" }).click();

  await expect(materialRow(page, "Arm")).toHaveAttribute("aria-selected", "true");
  await expect(materialRow(page, "Block")).toBeVisible();

  await materialRow(page, "Block").click();
  await expect.poll(() => selectedBlock(page)).toBe("Block");
  await expect(materialRow(page, "Block")).toHaveAttribute("aria-selected", "true");
  await expect(materialFooter(page).getByRole("button", { name: "Remove from Block" })).toBeVisible();
});

test("the menus copy and paste a material, and the header deletes it", async({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openMaterial(page, "Block");
  await newMaterial(page, "Metal");

  await (await materialRowMenu(page, "Metal")).getByRole("menuitem", { name: "Copy" }).click();
  await materialTool(page, "Delete");
  const form = dialog(page, "Delete Material");
  await expect(form).toContainText("Metal is used by 1 block. It will have no material.");
  await form.getByRole("button", { name: "Delete" }).click();
  await expect.poll(() => materialUses(page)).toEqual([]);
  expect(await blockSurface(page, "Block")).toBeNull();

  await (await materialRowMenu(page, null)).getByRole("menuitem", { name: "Paste" }).click();
  await expect.poll(() => materialUses(page)).toEqual([["Metal", 1]]);
  expect(await blockSurface(page, "Block")).toMatchObject({ metalness: 0.8 });
});

test("materials reorder with the keyboard and keep their order", async({ page }) => {
  await openMaterial(page, "Block");
  await newMaterial(page, "Glass");
  await newMaterial(page, "Metal");
  await expect(materialTab(page).getByRole("button", { name: "New Folder" })).toHaveCount(0);

  const metal = materialRow(page, "Metal");
  await metal.click();
  await metal.press(" ");
  await metal.press("ArrowLeft");
  await metal.press("ArrowLeft");
  await metal.press("Enter");

  await expect.poll(() => materialOutline(page)).toEqual(["Metal", "Glass"]);

  await page.reload();
  await waitForEditor(page);
  await expect.poll(() => materialOutline(page)).toEqual(["Metal", "Glass"]);
});

test("the fields sit in Color, Surface and Glow, which say when they cannot show", async({ page }) => {
  const library = await openMaterial(page, "Block");
  await newMaterial(page, "Material");
  function group(
    label: string
  ) {
    return library.locator(`jolly-folder[label="${label}"]`);
  }

  await expect(group("Color").getByRole("slider", { name: "Opacity" })).toBeVisible();
  await expect(group("Surface").getByRole("slider", { name: "Metalness" })).toBeVisible();
  await expect(group("Glow").getByRole("slider", { name: "Intensity" })).toBeVisible();
  await expect(group("Glow")).toContainText("Off");

  await newMaterial(page, "Glow");
  await expect(group("Glow")).not.toContainText("Off");

  const note = group("Surface").getByText("Roughness and metalness show with");
  await expect(note).toBeHidden();
  await page.getByRole("button", { name: "Shading: Lit" }).click();
  await expect(note).toBeVisible();
});

test("the new material menu shows each preset's swatch", async({ page }) => {
  await openMaterial(page, "Block");
  await materialTool(page, "New Material");

  await expect(materialMenu(page).locator("jolly-icon[name=material-preset-glass]")).toHaveCount(1);
});

test("the material help toggles its descriptions and is remembered", async({ page }) => {
  const library = await openMaterial(page, "Block");
  await newMaterial(page, "Material");
  const roughnessHelp = library.getByText("How blurred reflections are");
  await expect(roughnessHelp).toBeHidden();

  await library.getByRole("button", { name: "Help" }).click();
  await expect(roughnessHelp).toBeVisible();
  await expect(library.getByText("Editing a material changes every block")).toBeVisible();

  await page.reload();
  await waitForEditor(page);
  await openMaterial(page, "Block");
  await expect(materialTab(page).getByText("How blurred reflections are")).toBeVisible();
});

test("the Build tab keeps its texture canvas after a visit to the Material tab", async({ page }) => {
  await openMaterialTab(page);

  await page.getByRole("tab", { name: "Build" }).click();

  await expect(page.getByRole("img").filter({ hasText: "(Block)front" })).toBeVisible();
});

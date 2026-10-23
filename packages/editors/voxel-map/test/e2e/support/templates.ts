// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  measureCenter,
  dialog,
  textField
} from "@jolly-pixel/e2e";
import { pressAt } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type {
  Cell,
  Viewport
} from "./viewport.ts";

export class TemplateList {
  readonly root: Locator;
  readonly row: Locator;
  readonly renameBox: Locator;
  readonly selectedLayer: Locator;
  readonly placeButton: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;
  readonly editBar: Locator;
  readonly preview: Locator;
  readonly previewWell: Locator;
  readonly previewCanvas: Locator;
  readonly previewHint: Locator;
  readonly previewToggle: Locator;
  readonly previewDisabledHint: Locator;
  readonly #page: Page;
  readonly #viewport: Viewport;

  constructor(
    page: Page,
    viewport: Viewport
  ) {
    this.#page = page;
    this.#viewport = viewport;
    this.root = page.locator("template-manager");
    this.row = this.root.getByRole("treeitem");
    this.renameBox = this.root.getByRole("textbox", { name: "Rename" });
    this.selectedLayer = page.locator("layer-manager")
      .locator("[role=\"treeitem\"][aria-selected=\"true\"]");
    this.placeButton = this.root.getByRole("button", { name: "Place template" });
    this.deleteButton = this.root.getByRole("button", { name: "Delete template" });
    this.editButton = this.root.getByRole("button", { name: "Edit template" });
    this.editBar = page.getByRole("toolbar", { name: "Template editing" });
    this.preview = page.locator("template-preview");
    this.previewWell = this.preview.locator(".well");
    this.previewCanvas = this.previewWell.locator("canvas");
    this.previewHint = this.preview.getByText("Select a template to preview it.");
    this.previewToggle = this.preview.getByRole("button", { name: /^(Hide|Show) preview$/ });
    this.previewDisabledHint = this.preview.getByText("Preview disabled");
  }

  async saveLayer(): Promise<void> {
    await this.selectedLayer.locator(".label").click({ button: "right" });
    await this.#page.getByRole("menu", { name: "Layer actions" })
      .getByRole("menuitem", { name: "Save as template" })
      .click();
  }

  async place(): Promise<void> {
    await this.placeButton.click();
  }

  async remove(
    row: Locator
  ): Promise<void> {
    await row.locator(".label").click();
    await this.deleteButton.click();
    await dialog(this.#page, "Delete template")
      .getByRole("button", { name: "Delete" })
      .click();
  }

  async edit(
    row: Locator
  ): Promise<void> {
    await row.locator(".label").click();
    await this.editButton.click();
  }

  async applyEdits(): Promise<void> {
    await this.editBar.getByRole("button", { name: "Apply" }).click();
  }

  async finishEditing(): Promise<void> {
    await this.editBar.getByRole("button", { name: "Done" }).click();
  }

  draftVoxelCount(): Promise<number | null> {
    return this.#page.evaluate(() => {
      const { world } = window.voxelMapEditor!.editing.view.document;
      const draft = world.getLayers()
        .find((layer) => layer.id.startsWith("template-draft:"));

      return draft?.voxelCount ?? null;
    });
  }

  peerInDraft(): Promise<boolean> {
    return this.#page.evaluate(() => [
      ...window.voxelMapEditor!.editing.state.presence.layerSelections.keys()
    ].some((key) => key.includes("template-draft:")));
  }

  voxelCounts(): Promise<number[]> {
    return this.#page.evaluate(() => window.voxelMapEditor!.editing.view.document.world
      .templates.toArray()
      .map((template) => template.voxelCount));
  }

  async name(
    name: string
  ): Promise<void> {
    const prompt = dialog(this.#page, "Save as template");
    await textField(prompt, "Name").fill(name);
    await prompt.getByRole("button", { name: "Save" }).click();
  }

  async rename(
    name: string
  ): Promise<void> {
    await this.row.locator(".label").dblclick();
    await this.renameBox.fill(name);
    await this.renameBox.press("Enter");
  }

  async dragTo(
    cell: Cell
  ): Promise<void> {
    await pressAt(this.#page, [
      await measureCenter(this.row),
      await this.#viewport.cellTop(cell)
    ], {
      target: this.row
    });
  }
}

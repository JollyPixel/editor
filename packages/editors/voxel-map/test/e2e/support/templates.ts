// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  centerOf,
  dialog,
  pressAt,
  textField
} from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type {
  Cell,
  Viewport
} from "./viewport.ts";

export class TemplateList {
  readonly root: Locator;
  readonly row: Locator;
  readonly renameBox: Locator;
  readonly saveButton: Locator;
  readonly placeButton: Locator;
  readonly deleteButton: Locator;
  readonly preview: Locator;
  readonly previewWell: Locator;
  readonly previewCanvas: Locator;
  readonly previewHint: Locator;
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
    this.saveButton = this.root.getByRole("button", { name: "Save layer as template" });
    this.placeButton = this.root.getByRole("button", { name: "Place template" });
    this.deleteButton = this.root.getByRole("button", { name: "Delete template" });
    this.preview = page.locator("template-preview");
    this.previewWell = this.preview.locator(".well");
    this.previewCanvas = this.previewWell.locator("canvas");
    this.previewHint = this.preview.getByText("Select a template to preview it.");
  }

  async saveLayer(): Promise<void> {
    await this.saveButton.click();
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
      await centerOf(this.row),
      await this.#viewport.cellTop(cell)
    ], { settle: nextFrames });
  }
}

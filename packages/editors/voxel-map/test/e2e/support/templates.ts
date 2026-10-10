// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  centerOf,
  pressAt
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
  }

  async saveLayer(): Promise<void> {
    await this.saveButton.click();
  }

  async place(): Promise<void> {
    await this.placeButton.click();
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

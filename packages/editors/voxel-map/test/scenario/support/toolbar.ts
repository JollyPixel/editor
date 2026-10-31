// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class EditToolbar {
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly #root: Locator;

  constructor(
    page: Page
  ) {
    this.#root = page.locator("voxel-edit-toolbar");
    this.undoButton = this.#button(/^Undo/);
    this.redoButton = this.#button(/^Redo/);
  }

  commitButton(
    layer: string
  ): Locator {
    return this.#button(new RegExp(`^Commit into ${layer}`));
  }

  #button(
    name: RegExp
  ): Locator {
    return this.#root.getByRole("button", { name });
  }
}

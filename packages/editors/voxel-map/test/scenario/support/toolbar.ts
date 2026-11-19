// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export type SelectMode = "Box select" | "Corner select" | "Connected select";

export class EditToolbar {
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly selectToolButton: Locator;
  readonly #root: Locator;

  constructor(
    page: Page
  ) {
    this.#root = page.locator("voxel-edit-toolbar");
    this.undoButton = this.#button(/^Undo/);
    this.redoButton = this.#button(/^Redo/);
    this.selectToolButton = this.#root
      .getByRole("group", { name: "Tools" })
      .getByRole("button", { name: /^Select/ });
  }

  commitButton(
    layer: string
  ): Locator {
    return this.#button(new RegExp(`^Commit into ${layer}`));
  }

  selectModeButton(
    mode: SelectMode
  ): Locator {
    return this.#button(new RegExp(`^${mode}`));
  }

  #button(
    name: RegExp
  ): Locator {
    return this.#root.getByRole("button", { name });
  }
}

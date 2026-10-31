// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { measureCenter } from "@jolly-pixel/e2e";
import { pressAt } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import type {
  Cell,
  Viewport
} from "./viewport.ts";

export class TemplateList {
  readonly row: Locator;
  readonly #page: Page;
  readonly #viewport: Viewport;

  constructor(
    page: Page,
    viewport: Viewport
  ) {
    this.#page = page;
    this.#viewport = viewport;
    this.row = page.locator("template-manager").getByRole("treeitem");
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

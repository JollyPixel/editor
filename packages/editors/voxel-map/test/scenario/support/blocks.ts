// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { titledDialog } from "@jolly-pixel/e2e";

export class BlockLibrary {
  readonly addButton: Locator;
  readonly #listbox: Locator;

  constructor(
    scope: Locator
  ) {
    this.#listbox = scope.getByRole("listbox", { name: "Blocks" });
    this.addButton = scope.getByRole("button", {
      name: "Add block",
      exact: true
    });
  }

  option(
    name: string
  ): Locator {
    return this.#listbox.getByRole("option", {
      name,
      exact: true
    });
  }

  async select(
    name: string
  ): Promise<void> {
    await this.option(name).click();
  }
}

export class BlocksPane {
  readonly library: BlockLibrary;

  constructor(
    page: Page
  ) {
    this.library = new BlockLibrary(page.locator("blocks-panel"));
  }
}

export class BlockDialog {
  readonly createButton: Locator;

  constructor(
    page: Page,
    title: string
  ) {
    this.createButton = titledDialog(page, title)
      .getByRole("button", { name: "Create" });
  }
}

// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  dialogTitle,
  gridSelectField,
  gridSelectOption,
  titledDialog
} from "@jolly-pixel/e2e";

export class BlockLibrary {
  readonly addButton: Locator;
  readonly #listbox: Locator;
  readonly #menu: Locator;

  constructor(
    scope: Locator
  ) {
    this.#listbox = scope.getByRole("listbox", { name: "Blocks" });
    this.#menu = scope.getByRole("menu", { name: "Block actions" });
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

  async edit(
    name: string
  ): Promise<void> {
    await this.option(name).dblclick();
  }

  async choose(
    name: string,
    action: string
  ): Promise<void> {
    await this.option(name).click({ button: "right" });
    await this.#menu.getByRole("menuitem", {
      name: action,
      exact: true
    }).click();
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
  readonly closeButton: Locator;
  readonly #root: Locator;

  constructor(
    page: Page,
    title: string
  ) {
    this.#root = titledDialog(page, title);
    this.createButton = this.#root.getByRole("button", { name: "Create" });
    this.closeButton = this.#root.getByRole("button", { name: "Close" });
  }

  async rename(
    name: string
  ): Promise<void> {
    const title = dialogTitle(this.#root);
    await title.fill(name);
    await title.press("Enter");
  }

  async pickShape(
    label: string
  ): Promise<void> {
    await gridSelectField(this.#root, "Shape").click();
    await gridSelectOption(this.#root, "Shape", label).click();
  }
}

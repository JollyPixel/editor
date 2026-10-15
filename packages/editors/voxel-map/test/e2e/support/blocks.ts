// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  buttonGroup,
  dialogTitle,
  titledDialog
} from "@jolly-pixel/e2e";

export class BlockLibrary {
  readonly listbox: Locator;
  readonly options: Locator;
  readonly addButton: Locator;
  readonly canvas: Locator;
  readonly heightGrip: Locator;
  readonly menu: Locator;
  readonly #root: Locator;

  constructor(
    scope: Locator
  ) {
    this.#root = scope;
    this.listbox = scope.getByRole("listbox", { name: "Blocks" });
    this.options = this.listbox.getByRole("option");
    this.addButton = scope.getByRole("button", {
      name: "Add block",
      exact: true
    });
    this.canvas = scope.locator("block-library-viewport canvas");
    this.heightGrip = scope.getByRole("separator", {
      name: "Block library height"
    });
    this.menu = scope.getByRole("menu", { name: "Block actions" });
  }

  option(
    name: string
  ): Locator {
    return this.listbox.getByRole("option", {
      name,
      exact: true
    });
  }

  swatch(
    blockId: number
  ): Locator {
    return this.#root.locator(
      `block-library-viewport .material[data-block-id="${blockId}"] .swatch`
    );
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
    ...labels: string[]
  ): Promise<void> {
    await this.option(name).click({ button: "right" });
    let menu = this.menu;
    for (const label of labels) {
      await menu.getByRole("menuitem", {
        name: label,
        exact: true
      }).click();
      menu = menu.getByRole("menu", { name: label });
    }
  }
}

export class BlocksPane {
  readonly root: Locator;
  readonly library: BlockLibrary;
  readonly orderButton: Locator;
  readonly orderMenu: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("blocks-panel");
    this.library = new BlockLibrary(this.root);
    this.orderButton = this.root.getByRole("button", { name: /^Order:/ });
    this.orderMenu = page.getByRole("menu", { name: "Block order" });
  }
}

export class BlockDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly alert: Locator;
  readonly transparency: Locator;
  readonly alpha: Locator;
  readonly sides: Locator;
  readonly uvSizes: Locator;
  readonly properties: Locator;
  readonly disabledBlockset: Locator;
  readonly createButton: Locator;
  readonly closeButton: Locator;
  readonly deleteButton: Locator;

  constructor(
    page: Page,
    title: string
  ) {
    this.root = titledDialog(page, title);
    this.title = dialogTitle(this.root);
    this.alert = this.root.getByRole("alert");
    this.transparency = this.root.getByText("Transparency");
    this.alpha = buttonGroup(this.root, "Alpha");
    this.sides = buttonGroup(this.root, "Sides");
    this.uvSizes = buttonGroup(this.root, "UV size");
    this.properties = this.root.locator("custom-properties-editor");
    this.disabledBlockset = this.root.locator("jolly-select[disabled]");
    this.createButton = this.root.getByRole("button", { name: "Create" });
    this.closeButton = this.root.getByRole("button", { name: "Close" });
    this.deleteButton = this.root.getByRole("button", { name: "Delete" });
  }

  async rename(
    name: string,
    commitKey = "Enter"
  ): Promise<void> {
    await this.title.fill(name);
    await this.title.press(commitKey);
  }
}

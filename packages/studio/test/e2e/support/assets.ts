// Import Third-party Dependencies
import {
  expect,
  type Download,
  type Locator,
  type Page
} from "@playwright/test";
import {
  boxOf,
  centerOf,
  dragTo,
  treeRow
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { AssetShareDialog } from "./shares.ts";

// CONSTANTS
export const MAP = "overworld.voxelmap.json";
export const BLOCKSET = "overworld.blockset.json";
export const MODEL = "model.voxelmodel.json";
export const TEXTURE = "model.pixelart";
export const SEED_FOLDERS = ["maps", "models"];
export const SEED_ROW_COUNT = 6;
const kBelowRowsOffset = 10;

export interface SeedOptions {
  collapsed?: boolean;
}

export class AssetMenu {
  readonly root: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.getByRole("menu", { name: "Asset actions" });
  }

  item(
    name: string
  ): Locator {
    return this.root.getByRole("menuitem", {
      name,
      exact: true
    });
  }
}

export class AssetDeleteDialog {
  readonly root: Locator;
  readonly companionNotice: Locator;
  readonly companions: Locator;
  readonly deleteButton: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("asset-delete-dialog");
    this.companionNotice = this.root.getByText("Also delete its companion");
    this.companions = this.root.getByRole("checkbox");
    this.deleteButton = this.root.getByRole("button", {
      name: "Delete",
      exact: true
    });
  }
}

export class AssetBrowser {
  readonly root: Locator;
  readonly tree: Locator;
  readonly rows: Locator;
  readonly kinds: Locator;
  readonly renameField: Locator;
  readonly menu: AssetMenu;
  readonly deleteDialog: AssetDeleteDialog;
  readonly shareDialog: AssetShareDialog;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.root = page.locator("asset-browser");
    this.tree = this.root.locator("jolly-tree");
    this.rows = this.tree.getByRole("treeitem");
    this.kinds = this.root.locator("jolly-button-group");
    this.renameField = this.root.getByRole("textbox", { name: "Rename" });
    this.menu = new AssetMenu(page);
    this.deleteDialog = new AssetDeleteDialog(page);
    this.shareDialog = new AssetShareDialog(page);
  }

  row(
    name: string
  ): Locator {
    return treeRow(this.#page, name);
  }

  action(
    name: string
  ): Locator {
    return this.root.getByRole("button", { name });
  }

  async expectSeeded(
    options: SeedOptions = {}
  ): Promise<void> {
    await expect(this.rows).toHaveCount(
      options.collapsed ? SEED_FOLDERS.length : SEED_ROW_COUNT
    );
  }

  async filterBy(
    kind: string
  ): Promise<void> {
    await this.kinds.getByRole("radio", { name: kind }).click();
  }

  async expand(
    folder: string
  ): Promise<void> {
    await this.row(folder).getByRole("button", { name: "Expand" }).click();
  }

  async collapse(
    folder: string
  ): Promise<void> {
    await this.row(folder).getByRole("button", { name: "Collapse" }).click();
  }

  async select(
    ...names: string[]
  ): Promise<void> {
    const [first, ...others] = names;
    await this.row(first).click();
    for (const name of others) {
      await this.row(name).click({ modifiers: ["ControlOrMeta"] });
    }
  }

  async open(
    name: string
  ): Promise<void> {
    await this.row(name).dblclick();
  }

  async move(
    source: string,
    target: string
  ): Promise<void> {
    await dragTo(this.#page, this.row(source), await centerOf(this.row(target)));
  }

  async rename(
    name: string
  ): Promise<void> {
    await this.renameField.fill(name);
    await this.renameField.press("Enter");
  }

  async createFolder(
    name: string
  ): Promise<void> {
    await this.action("New folder").click();
    await this.rename(name);
  }

  async createAsset(
    kind: string
  ): Promise<void> {
    await this.action("New asset").click();
    await this.menu.item(kind).click();
  }

  async openMenu(
    name: string
  ): Promise<void> {
    await this.row(name).click({ button: "right" });
  }

  async openMenuBelowRows(): Promise<void> {
    const tree = await boxOf(this.tree);
    await this.#page.mouse.click(
      tree.x + (tree.width / 2),
      tree.y + tree.height - kBelowRowsOffset,
      { button: "right" }
    );
  }

  async exportSelection(): Promise<Download> {
    const download = this.#page.waitForEvent("download");
    await this.action("Export").click();

    return download;
  }
}

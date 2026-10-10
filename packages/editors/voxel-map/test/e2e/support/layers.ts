// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import {
  buttonGroup,
  dialog,
  textField
} from "@jolly-pixel/e2e";

export type LayerKind = "Voxel" | "Objects" | "Object";

export class LayersPane {
  readonly tree: Locator;
  readonly rows: Locator;
  readonly renameBox: Locator;
  readonly addButton: Locator;
  readonly cloneButton: Locator;
  readonly mergeButton: Locator;
  readonly removeButton: Locator;
  readonly panel: Locator;
  readonly properties: Locator;
  readonly rebaseButton: Locator;
  readonly transformButton: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.tree = page.locator("layer-manager");
    this.rows = this.tree.getByRole("treeitem");
    this.renameBox = this.tree.getByRole("textbox", { name: "Rename" });
    this.addButton = this.tree.getByRole("button", { name: "Add layer" });
    this.cloneButton = this.tree.getByRole("button", { name: "Clone layer" });
    this.mergeButton = this.tree.getByRole("button", { name: "Merge layer" });
    this.removeButton = this.tree.getByRole("button", { name: "Remove layer" });
    this.panel = page.locator("layer-panel");
    this.properties = this.panel.locator("custom-properties-editor");
    this.rebaseButton = this.panel.getByRole("button", { name: "Rebase to content origin" });
    this.transformButton = this.panel.getByRole("button", { name: "Transform" });
  }

  row(
    name: string
  ): Locator {
    return this.tree.locator(`[role="treeitem"][data-id$=":${name}"]`);
  }

  objectRow(
    name: string
  ): Locator {
    return this.tree.getByRole("treeitem", { name: new RegExp(`^${name}`) });
  }

  async add(
    kind: LayerKind,
    name: string
  ): Promise<void> {
    await this.addButton.click();
    const form = dialog(this.#page, "New");
    await buttonGroup(form, "Kind")
      .getByRole("radio", { name: kind, exact: true })
      .click();
    await textField(form, "Name").fill(name);
    await form.getByRole("button", { name: "Create" }).click();
    await expect(form).toBeHidden();
  }

  async rename(
    row: Locator,
    name: string
  ): Promise<void> {
    await row.locator(".label").dblclick();
    await this.renameBox.fill(name);
    await this.renameBox.press("Enter");
  }
}

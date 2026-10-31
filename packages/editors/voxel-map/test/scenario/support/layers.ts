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

export type LayerKind = "Voxel" | "Objects";

export class LayersPane {
  readonly #page: Page;
  readonly #tree: Locator;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#tree = page.locator("layer-manager");
  }

  row(
    name: string
  ): Locator {
    return this.#tree.locator(`[role="treeitem"][data-id$=":${name}"]`);
  }

  async add(
    kind: LayerKind,
    name: string
  ): Promise<void> {
    await this.#tree.getByRole("button", { name: "Add layer" }).click();
    const form = dialog(this.#page, "New");
    await buttonGroup(form, "Kind")
      .getByRole("radio", { name: kind, exact: true })
      .click();
    await textField(form, "Name").fill(name);
    await form.getByRole("button", { name: "Create" }).click();
    await expect(form).toBeHidden();
  }

  async saveAsTemplate(
    name: string
  ): Promise<void> {
    await this.row(name).locator(".label").click({ button: "right" });
    await this.#page.getByRole("menu", { name: "Layer actions" })
      .getByRole("menuitem", { name: "Save as template" })
      .click();
  }
}

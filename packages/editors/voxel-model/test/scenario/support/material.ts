// Import Third-party Dependencies
import {
  expect,
  type Locator,
  type Page
} from "@playwright/test";
import type { MaterialSurfaceJSON } from "@jolly-pixel/asset.voxel-model/client";
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  blockSurface,
  materialOutline,
  type SurfaceSource
} from "./scene.ts";
import {
  dropByKeyboard,
  type KeyboardDrop
} from "./tree.ts";

export class MaterialPanel {
  readonly library: Locator;

  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.library = page.locator("jolly-model-editor-material-library");
  }

  async open(
    block: string
  ): Promise<void> {
    const row = treeRow(this.#page, block);
    await row.hover();
    await row.getByRole("button", { name: /material/i }).click();
    await expect(this.library).toBeVisible();
  }

  row(
    name: string
  ): Locator {
    return this.library.getByRole("treeitem").filter({
      has: this.#page.getByText(name, { exact: true })
    });
  }

  async create(
    preset: string
  ): Promise<void> {
    await this.library
      .getByRole("toolbar", { name: "Material tools" })
      .getByRole("button", { name: "New Material", exact: true })
      .click();
    await this.#menu().getByRole("menuitem", { name: preset }).click();
  }

  async rename(
    from: string,
    to: string
  ): Promise<void> {
    await this.row(from).click({ button: "right" });
    await this.#menu().getByRole("menuitem", { name: "Rename" }).click();
    const rename = this.#page.getByRole("textbox", { name: "Rename" });
    await rename.fill(to);
    await rename.press("Enter");
    await expect(this.row(to)).toBeVisible();
  }

  async tint(
    hex: string
  ): Promise<void> {
    const field = this.library
      .locator("jolly-color[label=\"Tint\"]")
      .getByRole("textbox", { name: "Hex value" });
    await field.fill(hex);
    await field.press("Enter");
  }

  async holdSlider(
    name: string,
    fraction: number
  ): Promise<void> {
    const box = await this.library.getByRole("slider", { name }).boundingBox();
    if (box === null) {
      throw new Error(`The ${name} slider is not visible.`);
    }
    const { mouse } = this.#page;
    const y = box.y + (box.height / 2);

    await mouse.move(box.x + 1, y);
    await mouse.down();
    await mouse.move(box.x + (box.width * fraction), y, { steps: 4 });
  }

  async applyTo(
    block: string
  ): Promise<void> {
    await this.library
      .locator(".footer")
      .getByRole("button", { name: `Apply to ${block}` })
      .click();
  }

  async move(
    name: string,
    drop: KeyboardDrop
  ): Promise<void> {
    await dropByKeyboard(this.row(name), drop);
  }

  outline(): Promise<string[]> {
    return materialOutline(this.#page);
  }

  surface(
    block: string,
    source: SurfaceSource = "scene"
  ): Promise<MaterialSurfaceJSON> {
    return blockSurface(this.#page, block, source);
  }

  #menu(): Locator {
    return this.#page.getByRole("menu", { name: "Material actions" });
  }
}

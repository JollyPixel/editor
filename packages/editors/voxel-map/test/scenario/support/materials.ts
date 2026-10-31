// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { BlockLibrary } from "./blocks.ts";

export class MaterialsPane {
  readonly library: BlockLibrary;
  readonly applyButton: Locator;
  readonly #renameBox: Locator;
  readonly #newButton: Locator;
  readonly #color: Locator;

  constructor(
    page: Page
  ) {
    const root = page.locator("materials-panel");
    this.library = new BlockLibrary(root);
    this.applyButton = root.getByRole("button", { name: "Apply to selected block" });
    this.#renameBox = root.getByRole("tree").getByRole("textbox");
    this.#newButton = root.getByRole("button", { name: "New material" });
    this.#color = root
      .locator("jolly-color")
      .filter({ hasText: "Swatch" })
      .locator("input.hex");
  }

  async create(
    name: string
  ): Promise<void> {
    await this.#newButton.click();
    await this.#renameBox.fill(name);
    await this.#renameBox.press("Enter");
  }

  async changeColor(
    hex: string
  ): Promise<void> {
    await this.#color.fill(hex);
    await this.#color.press("Enter");
  }
}

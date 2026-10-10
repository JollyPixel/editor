// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

// Import Internal Dependencies
import { BlockLibrary } from "./blocks.ts";

export class MaterialsPane {
  readonly root: Locator;
  readonly library: BlockLibrary;
  readonly blockLibrary: Locator;
  readonly selected: Locator;
  readonly renameBox: Locator;
  readonly newButton: Locator;
  readonly applyButton: Locator;
  readonly removeButton: Locator;
  readonly color: Locator;
  readonly roughness: Locator;
  readonly materialLibrary: Locator;
  readonly viewSettings: Locator;
  readonly noBlocksHint: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("materials-panel");
    this.library = new BlockLibrary(this.root);
    this.blockLibrary = this.root.locator("block-library");
    this.selected = this.root
      .getByRole("treeitem", { selected: true })
      .locator(".label");
    this.renameBox = this.root.getByRole("tree").getByRole("textbox");
    this.newButton = this.root.getByRole("button", { name: "New material" });
    this.applyButton = this.root.getByRole("button", { name: "Apply to selected block" });
    this.removeButton = this.root.getByRole("button", { name: "Remove from selected block" });
    this.color = this.root
      .locator("jolly-color")
      .filter({ hasText: "Color" })
      .locator("input.hex");
    this.roughness = this.root.getByRole("spinbutton", { name: "Roughness" });
    this.materialLibrary = this.root.locator("material-library");
    this.viewSettings = this.root.locator("map-config-panel");
    this.noBlocksHint = this.root.getByText("Add a block to the map to edit materials.");
  }

  async create(
    name: string
  ): Promise<void> {
    await this.newButton.click();
    await this.renameBox.fill(name);
    await this.renameBox.press("Enter");
  }

  async changeColor(
    hex: string
  ): Promise<void> {
    await this.color.fill(hex);
    await this.color.press("Enter");
  }

  async changeRoughness(
    value: number
  ): Promise<void> {
    await this.roughness.fill(String(value));
    await this.roughness.press("Enter");
  }
}

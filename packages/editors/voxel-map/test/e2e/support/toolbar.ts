// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";

export class EditToolbar {
  readonly root: Locator;
  readonly rail: Locator;
  readonly railButtons: Locator;
  readonly railCaptions: Locator;
  readonly status: Locator;
  readonly brushTools: Locator;
  readonly history: Locator;
  readonly rotate: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly ghostButton: Locator;
  readonly selectButton: Locator;
  readonly connectedSelectButton: Locator;
  readonly pasteButton: Locator;
  readonly saveTemplateButton: Locator;
  readonly cancelButton: Locator;

  constructor(
    page: Page
  ) {
    this.root = page.locator("voxel-edit-toolbar");
    this.rail = this.root.locator("jolly-rail");
    this.railButtons = this.rail
      .locator("jolly-tool-button:not([slot])")
      .filter({ visible: true });
    this.railCaptions = this.rail
      .getByRole("status")
      .filter({ visible: true });
    this.status = this.root.getByRole("status");
    this.brushTools = this.root.getByRole("group", { name: "Brush" });
    this.history = this.root.getByRole("group", { name: "History" });
    this.rotate = this.root.getByRole("group", { name: "Rotate" });
    this.undoButton = this.button(/^Undo/);
    this.redoButton = this.button(/^Redo/);
    this.ghostButton = this.button(/^Ghost block/);
    this.selectButton = this.button(/^Select/);
    this.connectedSelectButton = this.button(/^Connected select/);
    this.pasteButton = this.root.getByRole("button", {
      name: /^Paste/,
      includeHidden: true
    }).first();
    this.cancelButton = this.button(/^Cancel/);
    this.saveTemplateButton = this.button("Save as template");
  }

  button(
    name: string | RegExp
  ): Locator {
    return this.root.getByRole("button", {
      name,
      exact: typeof name === "string"
    });
  }

  sizeButton(
    size: number
  ): Locator {
    return this.button(new RegExp(`^Size ${size}`));
  }

  commitButton(
    layer: string
  ): Locator {
    return this.button(new RegExp(`^Commit into ${layer}`));
  }
}

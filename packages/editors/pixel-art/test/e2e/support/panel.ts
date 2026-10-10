// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { TextureCanvas } from "./canvas.ts";
import { ColorControls } from "./colors.ts";
import type { PngFile } from "./files.ts";
import { ModeRail } from "./modeRail.ts";
import { NormalMapDock } from "./normalMap.ts";
import { RegionVisibility } from "./regionVisibility.ts";
import {
  ImportDialog,
  TextureTabs
} from "./textures.ts";
import { UvToolbar } from "./uvToolbar.ts";
import type {
  PixelDrawPanel,
  UvAccess
} from "../../../src/index.ts";

export class PixelArtPanel {
  readonly page: Page;
  readonly root: Locator;
  readonly canvas: TextureCanvas;
  readonly modes: ModeRail;
  readonly visibility: RegionVisibility;
  readonly colors: ColorControls;
  readonly normalMap: NormalMapDock;
  readonly uv: UvToolbar;
  readonly textures: TextureTabs;
  readonly importDialog: ImportDialog;
  readonly bottomToolbar: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly clearButton: Locator;
  readonly importButton: Locator;
  readonly exportButton: Locator;
  readonly accessBadge: Locator;
  readonly dropStatus: Locator;
  readonly busy: Locator;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.root = page.locator("pixel-draw-panel");
    this.canvas = new TextureCanvas(this.root);
    this.modes = new ModeRail(this.root);
    this.visibility = new RegionVisibility(this.root);
    this.colors = new ColorControls(this.root);
    this.normalMap = new NormalMapDock(this.root);
    this.uv = new UvToolbar(this.root);
    this.textures = new TextureTabs(this.root);
    this.importDialog = new ImportDialog(page);
    this.bottomToolbar = this.root.locator("[part=history-file-toolbar]");
    this.undoButton = this.#button("Undo");
    this.redoButton = this.#button("Redo");
    this.clearButton = this.#button("Clear texture");
    this.importButton = this.#button("Import texture");
    this.exportButton = this.#button("Export texture");
    this.accessBadge = this.root.locator("[part=access-badge]");
    this.dropStatus = this.root.locator("[part=drop-status]");
    this.busy = this.root.locator(".stage-busy");
  }

  #button(
    name: string
  ): Locator {
    return this.root.getByRole("button", {
      name,
      exact: true
    });
  }

  async import(
    file: PngFile
  ): Promise<void> {
    await this.root.locator(".file-input").setInputFiles(file);
  }

  async changeUvAccess(
    access: UvAccess
  ): Promise<void> {
    await this.root.evaluate((element: PixelDrawPanel, value) => {
      element.uvAccess = value;

      return element.updateComplete;
    }, access);
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await waitForEditor(this.page);
  }
}

// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  openEditor,
  waitForEditor
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { Archives } from "./archives.ts";
import {
  BlockDialog,
  BlocksPane
} from "./blocks.ts";
import { Brush } from "./brush.ts";
import { PaneDock } from "./dock.ts";
import { LayersPane } from "./layers.ts";
import { MaterialsPane } from "./materials.ts";
import { Placement } from "./placement.ts";
import { TemplateList } from "./templates.ts";
import { TextureEditor } from "./texture.ts";
import { EditToolbar } from "./toolbar.ts";
import { Viewport } from "./viewport.ts";
import { MapWorld } from "./world.ts";

// CONSTANTS
const kOfflineEditor = {
  maxFps: 10,
  query: {
    offline: "",
    samples: "0",
    render: "on-demand"
  }
};

export class VoxelMapPage {
  readonly page: Page;
  readonly viewport: Viewport;
  readonly world: MapWorld;
  readonly brush: Brush;
  readonly placement: Placement;
  readonly toolbar: EditToolbar;
  readonly panes: PaneDock;
  readonly archives: Archives;
  readonly blocks: BlocksPane;
  readonly materials: MaterialsPane;
  readonly texture: TextureEditor;
  readonly layers: LayersPane;
  readonly templates: TemplateList;
  readonly log: Locator;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.viewport = new Viewport(page);
    this.world = new MapWorld(page);
    this.brush = new Brush(page);
    this.placement = new Placement(page);
    this.toolbar = new EditToolbar(page);
    this.panes = new PaneDock(page);
    this.archives = new Archives(page);
    this.blocks = new BlocksPane(page);
    this.materials = new MaterialsPane(page);
    this.texture = new TextureEditor(page);
    this.layers = new LayersPane(page);
    this.templates = new TemplateList(page, this.viewport);
    this.log = page.locator("jolly-log");
  }

  blockDialog(
    title: string
  ): BlockDialog {
    return new BlockDialog(this.page, title);
  }

  collaborator(
    username: string
  ): Locator {
    return this.page.getByRole("button", { name: `Select ${username}` });
  }

  async openOffline(): Promise<void> {
    await openEditor(this.page, kOfflineEditor);
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await waitForEditor(this.page);
  }
}

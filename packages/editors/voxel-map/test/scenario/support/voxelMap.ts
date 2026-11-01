// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import { CommandConsole } from "@jolly-pixel/e2e";
import {
  openEditor,
  reloadEditor
} from "@jolly-pixel/e2e/editor";
import { ArchiveConsole } from "@jolly-pixel/e2e/scenario";

// Import Internal Dependencies
import {
  BlockDialog,
  BlocksPane
} from "./blocks.ts";
import { PaneDock } from "./dock.ts";
import { LayersPane } from "./layers.ts";
import { MaterialsPane } from "./materials.ts";
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
  readonly viewport: Viewport;
  readonly world: MapWorld;
  readonly toolbar: EditToolbar;
  readonly panes: PaneDock;
  readonly archives: ArchiveConsole;
  readonly blocks: BlocksPane;
  readonly materials: MaterialsPane;
  readonly texture: TextureEditor;
  readonly layers: LayersPane;
  readonly templates: TemplateList;
  readonly #page: Page;
  readonly #commands: CommandConsole;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#commands = new CommandConsole(page);
    this.viewport = new Viewport(page);
    this.world = new MapWorld(page);
    this.toolbar = new EditToolbar(page);
    this.panes = new PaneDock(page);
    this.archives = new ArchiveConsole(page);
    this.blocks = new BlocksPane(page);
    this.materials = new MaterialsPane(page);
    this.texture = new TextureEditor(page);
    this.layers = new LayersPane(page);
    this.templates = new TemplateList(page, this.viewport);
  }

  blockDialog(
    title: string
  ): BlockDialog {
    return new BlockDialog(this.#page, title);
  }

  async useBrush(
    block: string,
    size: number
  ): Promise<void> {
    await this.panes.open("Blocks");
    await this.blocks.library.select(block);
    await this.#commands.submit(`brush.size ${size}`);
    await this.#commands.close();
    await this.viewport.pinCamera();
  }

  async openOffline(): Promise<void> {
    await openEditor(this.#page, kOfflineEditor);
  }

  async reload(): Promise<void> {
    await reloadEditor(this.#page);
  }
}

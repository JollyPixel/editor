// Import Third-party Dependencies
import type { DockLayout } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../editing/VoxelMapEditing.ts";
import type { TextureEditor } from "../features/texture/TextureEditor.ts";
import "../features/texture/TextureEditor.ts";
import { BlocksPanel } from "./panels/BlocksPanel.ts";
import type { LayersPanel } from "./panels/LayersPanel.ts";
import type { MaterialsPanel } from "./panels/MaterialsPanel.ts";
import { PaintPanel } from "./panels/PaintPanel.ts";
import { TextureHost } from "./TextureHost.ts";

export interface EditorPanelElements {
  layout: DockLayout;
  blocks: BlocksPanel;
  paint: PaintPanel;
  layers: LayersPanel;
  materials: MaterialsPanel;
}

export class EditorPanels {
  readonly #elements: EditorPanelElements;
  #editing: VoxelMapEditing | null = null;
  #textureEditor: TextureEditor | null = null;
  #host = new TextureHost("blocks", true);

  static mount(
    root: ParentNode
  ): EditorPanels | null {
    const layout = root.querySelector("jolly-dock-layout");
    const blocks = root.querySelector("blocks-panel");
    const paint = root.querySelector("paint-panel");
    const layers = root.querySelector("layers-panel");
    const materials = root.querySelector("materials-panel");
    if (
      layout === null ||
      layers === null ||
      materials === null ||
      !(blocks instanceof BlocksPanel) ||
      !(paint instanceof PaintPanel)
    ) {
      return null;
    }

    return new EditorPanels({
      layout,
      blocks,
      paint,
      layers,
      materials
    });
  }

  constructor(
    elements: EditorPanelElements
  ) {
    this.#elements = elements;
  }

  get layout(): DockLayout {
    return this.#elements.layout;
  }

  attach(
    editing: VoxelMapEditing
  ): void {
    const {
      layout,
      blocks,
      layers,
      materials
    } = this.#elements;

    this.#editing = editing;
    blocks.editing = editing;
    layers.editing = editing;
    materials.editing = editing;

    const textureEditor = document.createElement("texture-editor");
    textureEditor.editing = editing;
    this.#textureEditor = textureEditor;

    layout.addEventListener("jolly-layout-change", this.#place);
    layout.addEventListener("jolly-pane-visibility", this.#place);
    void layout.updateComplete.then(this.#place);
  }

  dispose(): void {
    const { layout } = this.#elements;

    layout.removeEventListener("jolly-layout-change", this.#place);
    layout.removeEventListener("jolly-pane-visibility", this.#place);
    this.#textureEditor?.remove();
    this.#textureEditor = null;
  }

  readonly #place = (): void => {
    const textureEditor = this.#textureEditor;
    if (textureEditor === null) {
      return;
    }

    const { layout, blocks, paint, materials } = this.#elements;
    materials.showsBlockLibrary = !layout.paneVisible("blocks");
    this.#reveal("layers", () => import("./panels/LayersPanel.ts"));
    this.#reveal("materials", () => import("./panels/MaterialsPanel.ts"));

    const host = TextureHost.resolve(
      layout.placement("blocks"),
      layout.placement("paint"),
      this.#host.panel
    );
    this.#host = host;
    const panel = host.panel === "blocks" ? blocks : paint;
    if (textureEditor.parentElement !== panel) {
      panel.append(textureEditor);
    }
    blocks.hostsTextureEditor = host.panel === "blocks";
    textureEditor.uvAccess = host.uvAccess;
    textureEditor.active = layout.paneVisible(host.panel);
  };

  #reveal(
    pane: string,
    load: () => Promise<unknown>
  ): void {
    if (!this.#elements.layout.paneVisible(pane)) {
      return;
    }

    void load().catch((error: unknown) => {
      this.#editing?.state.log.push(
        `The ${pane} panel failed to load: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
}

// Import Third-party Dependencies
import type { DockLayout } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import type { TextureEditor } from "../features/texture/TextureEditor.ts";
import "../features/texture/TextureEditor.ts";
import { BlocksPanel } from "./panels/BlocksPanel.ts";
import { LayersPanel } from "./panels/LayersPanel.ts";
import { MaterialsPanel } from "./panels/MaterialsPanel.ts";
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
      !(blocks instanceof BlocksPanel) ||
      !(paint instanceof PaintPanel) ||
      !(layers instanceof LayersPanel) ||
      !(materials instanceof MaterialsPanel)
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
    workspace: VoxelMapWorkspace
  ): void {
    const {
      layout,
      blocks,
      layers,
      materials
    } = this.#elements;

    blocks.workspace = workspace;
    layers.workspace = workspace;
    materials.workspace = workspace;

    const textureEditor = document.createElement("texture-editor");
    textureEditor.workspace = workspace;
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
}

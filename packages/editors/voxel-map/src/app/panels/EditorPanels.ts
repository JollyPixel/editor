// Import Third-party Dependencies
import type { DockLayout } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import type { TextureEditor } from "../../features/texture/TextureEditor.ts";
import "../../features/texture/TextureEditor.ts";
import { BlocksPanel } from "./BlocksPanel.ts";
import { GeneralPanel } from "./GeneralPanel.ts";
import { LayersPanel } from "./LayersPanel.ts";
import { PaintPanel } from "./PaintPanel.ts";
import { TextureHost } from "./TextureHost.ts";

export interface EditorPanelElements {
  layout: DockLayout;
  general: GeneralPanel;
  blocks: BlocksPanel;
  paint: PaintPanel;
  layers: LayersPanel;
}

export class EditorPanels {
  readonly #elements: EditorPanelElements;
  #textureEditor: TextureEditor | null = null;
  #host = new TextureHost("blocks", true);

  static mount(
    root: ParentNode
  ): EditorPanels | null {
    const layout = root.querySelector("jolly-dock-layout");
    const general = root.querySelector("general-panel");
    const blocks = root.querySelector("blocks-panel");
    const paint = root.querySelector("paint-panel");
    const layers = root.querySelector("layers-panel");
    if (
      layout === null ||
      !(general instanceof GeneralPanel) ||
      !(blocks instanceof BlocksPanel) ||
      !(paint instanceof PaintPanel) ||
      !(layers instanceof LayersPanel)
    ) {
      return null;
    }

    return new EditorPanels({
      layout,
      general,
      blocks,
      paint,
      layers
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
    const { layout, general, blocks, layers } = this.#elements;

    general.workspace = workspace;
    blocks.workspace = workspace;
    layers.workspace = workspace;

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

    const { layout, blocks, paint } = this.#elements;
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

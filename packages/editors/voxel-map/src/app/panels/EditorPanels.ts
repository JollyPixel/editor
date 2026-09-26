// Import Third-party Dependencies
import type { DockLayout } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import type { TextureEditor } from "../../features/texture/TextureEditor.ts";
import { BlocksPanel } from "./BlocksPanel.ts";
import { GeneralPanel } from "./GeneralPanel.ts";
import { LayersPanel } from "./LayersPanel.ts";
import { PaintPanel } from "./PaintPanel.ts";
import {
  resolveTextureHost,
  texturePanesGrouped,
  textureUvAccess,
  type TextureHost
} from "./textureHost.ts";

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
  #host: TextureHost = "blocks";

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

    general.attach(workspace);
    blocks.attach(workspace);
    layers.attach(workspace);

    const textureEditor = document.createElement("texture-editor");
    textureEditor.brush = workspace.state.brush;
    textureEditor.tilesets = workspace.state.tilesets;
    textureEditor.mapDocument = workspace.mapDocument;
    textureEditor.engine = workspace.engine;
    textureEditor.linked = workspace.linkedTilesets;
    textureEditor.actions = workspace.tilesetActions;
    textureEditor.usage = workspace.usage;
    textureEditor.log = workspace.state.log;
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
    const blocksPlacement = layout.placement("blocks");
    const paintPlacement = layout.placement("paint");
    this.#host = resolveTextureHost(
      blocksPlacement,
      paintPlacement,
      this.#host
    );
    const panel = this.#host === "blocks" ? blocks : paint;
    if (textureEditor.parentElement !== panel) {
      panel.append(textureEditor);
    }
    blocks.hostsTextureEditor = this.#host === "blocks";
    textureEditor.uvAccess = textureUvAccess(
      this.#host,
      texturePanesGrouped(blocksPlacement, paintPlacement)
    );
    textureEditor.active = layout.paneVisible(this.#host);
  };
}

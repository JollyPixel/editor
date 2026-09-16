// Import Third-party Dependencies
import type { DockLayout } from "@jolly-pixel/ui";
import type {
  VoxelEngine,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import type { GridRenderer } from "../../scene/GridRenderer.ts";
import type { LocalBrush } from "../../features/painting/index.ts";
import type { TextureEditor } from "../../features/texture/TextureEditor.ts";
import type { ViewFocus } from "../../scene/viewFocus.ts";
import type { EventCanvasHoverChange } from "../../shared/domEvents.ts";
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

export interface EditorPanelsOptions {
  state: EditorState;
  viewFocus: ViewFocus;
  textureRoom?: network.Room<PixelNetworkCommand, PixelServerMessage>;
  onLoadWorld(data: VoxelWorldJSON): void;
  onTeleportToPeer(clientId: string): void;
  onCanvasHoverChange(hovering: boolean): void;
}

export interface EditorPanelsHandles {
  engine: VoxelEngine;
  gridRenderer: GridRenderer;
  localBrush: LocalBrush;
}

export class EditorPanels {
  readonly #layout: DockLayout;
  readonly #general: GeneralPanel;
  readonly #blocks: BlocksPanel;
  readonly #paint: PaintPanel;
  readonly #layers: LayersPanel;
  readonly #textureEditor: TextureEditor;
  readonly #onCanvasHoverChange: (hovering: boolean) => void;
  #host: TextureHost = "blocks";

  static mount(
    root: ParentNode,
    options: EditorPanelsOptions
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

    return new EditorPanels(
      {
        layout,
        general,
        blocks,
        paint,
        layers
      },
      options
    );
  }

  constructor(
    elements: {
      layout: DockLayout;
      general: GeneralPanel;
      blocks: BlocksPanel;
      paint: PaintPanel;
      layers: LayersPanel;
    },
    options: EditorPanelsOptions
  ) {
    this.#layout = elements.layout;
    this.#general = elements.general;
    this.#blocks = elements.blocks;
    this.#paint = elements.paint;
    this.#layers = elements.layers;
    this.#onCanvasHoverChange = options.onCanvasHoverChange;

    this.#general.state = options.state;
    this.#general.onLoadWorld = options.onLoadWorld;
    this.#general.onTeleportToPeer = options.onTeleportToPeer;
    this.#blocks.state = options.state;
    this.#layers.state = options.state;
    this.#layers.viewFocus = options.viewFocus;

    this.#textureEditor = document.createElement("texture-editor");
    this.#textureEditor.brush = options.state.brush;
    this.#textureEditor.worldStore = options.state.world;
    this.#textureEditor.room = options.textureRoom;

    this.#layout.addEventListener("jolly-layout-change", this.#place);
    this.#layout.addEventListener("jolly-pane-visibility", this.#place);
    this.#layout.addEventListener("world-loaded", this.#refresh);
    this.#layout.addEventListener("canvas-hover-change", this.#onHover);
    void this.#layout.updateComplete.then(this.#place);
  }

  adoptHandles(
    handles: EditorPanelsHandles
  ): void {
    this.#general.engine = handles.engine;
    this.#general.gridRenderer = handles.gridRenderer;
    this.#general.localBrush = handles.localBrush;
    this.#blocks.engine = handles.engine;
    this.#layers.engine = handles.engine;
    this.#textureEditor.engine = handles.engine;
  }

  dispose(): void {
    this.#layout.removeEventListener("jolly-layout-change", this.#place);
    this.#layout.removeEventListener("jolly-pane-visibility", this.#place);
    this.#layout.removeEventListener("world-loaded", this.#refresh);
    this.#layout.removeEventListener("canvas-hover-change", this.#onHover);
    this.#textureEditor.remove();
  }

  readonly #place = (): void => {
    const blocks = this.#layout.placement("blocks");
    const paint = this.#layout.placement("paint");
    this.#host = resolveTextureHost(blocks, paint, this.#host);
    const panel = this.#host === "blocks" ? this.#blocks : this.#paint;
    if (this.#textureEditor.parentElement !== panel) {
      panel.append(this.#textureEditor);
    }
    this.#blocks.hostsTextureEditor = this.#host === "blocks";
    this.#textureEditor.uvAccess = textureUvAccess(
      this.#host,
      texturePanesGrouped(blocks, paint)
    );
    this.#textureEditor.active = this.#layout.paneVisible(this.#host);
  };

  readonly #refresh = (): void => {
    this.#general.requestUpdate();
    this.#blocks.requestUpdate();
    this.#layers.requestUpdate();
  };

  readonly #onHover = (event: EventCanvasHoverChange): void => {
    this.#onCanvasHoverChange(event.detail.hovering);
  };
}

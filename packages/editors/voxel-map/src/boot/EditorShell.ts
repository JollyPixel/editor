// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { EditorState } from "../app/state/index.ts";
import type {
  EditorScene,
  EditorSceneHandles
} from "../app/EditorScene.ts";
import { EditorPanels } from "../app/panels/index.ts";
import type { ViewFocus } from "../scene/index.ts";
import type { TilesetTextures } from "../features/tilesets/TilesetTextures.ts";

// CONSTANTS
const kCanvasHoverEvent = "canvas-hover-change";

export interface EditorShellOptions {
  state: EditorState;
  viewFocus: ViewFocus;
  runtime: EditorRuntime;
  scene: EditorScene;
}

export class EditorShell {
  #panels: EditorPanels | null = null;
  #toolbar: HTMLElementTagNameMap["voxel-brush-toolbar"] | null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const {
      state,
      viewFocus,
      runtime,
      scene
    } = options;

    const activityLog = document.querySelector("jolly-log");
    if (activityLog) {
      activityLog.entries = state.log.entries;
      this.#disposables.push(
        state.log.subscribe((entries) => {
          activityLog.entries = entries;
        })
      );
    }

    const toolbar = document.querySelector("voxel-brush-toolbar");
    this.#toolbar = toolbar;
    if (toolbar) {
      toolbar.brush = state.brush;
      toolbar.selection = state.selection;
    }

    const panels = EditorPanels.mount(document, {
      state,
      viewFocus,
      onLoadWorld: (data) => scene.loadWorld(data),
      onTeleportToPeer: (clientId) => scene.teleportToPeer(clientId)
    });
    if (panels !== null) {
      this.#panels = panels;
      this.#disposables.push(
        runtime.suspendKeyboardOnHover(panels.layout, kCanvasHoverEvent),
        () => panels.dispose()
      );
    }
  }

  adoptHandles(
    handles: EditorSceneHandles,
    textures: TilesetTextures
  ): void {
    this.#panels?.adoptHandles({
      ...handles,
      textures
    });
    if (this.#toolbar) {
      this.#toolbar.history = handles.engine.history;
    }
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

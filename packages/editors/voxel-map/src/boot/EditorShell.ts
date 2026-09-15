// Import Third-party Dependencies
import type { Input } from "@jolly-pixel/engine";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorState } from "../app/state/index.ts";
import type {
  EditorScene,
  EditorSceneHandles
} from "../app/EditorScene.ts";
import { EditorPanels } from "../app/panels/index.ts";
import type { ViewFocus } from "../scene/index.ts";
import type { EditorTextureRoom } from "./EditorSession.ts";

export interface EditorShellOptions {
  state: EditorState;
  viewFocus: ViewFocus;
  input: Input;
  scene: EditorScene;
  textureRoom?: EditorTextureRoom;
}

export class EditorShell {
  #panels: EditorPanels | null = null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const {
      state,
      viewFocus,
      input,
      scene,
      textureRoom
    } = options;

    this.#disposables.push(
      input.keyboard.addGuard(inputLayers)
    );

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
    if (toolbar) {
      toolbar.brush = state.brush;
      toolbar.selection = state.selection;
    }

    const panels = EditorPanels.mount(document, {
      state,
      viewFocus,
      textureRoom,
      onLoadWorld: (data) => scene.loadWorld(data),
      onTeleportToPeer: (clientId) => scene.teleportToPeer(clientId),
      onCanvasHoverChange: (hovering) => {
        input.keyboard.enabled = !hovering;
      }
    });
    if (panels !== null) {
      this.#panels = panels;
      this.#disposables.push(() => panels.dispose());
    }
  }

  adoptHandles(
    handles: EditorSceneHandles
  ): void {
    this.#panels?.adoptHandles(handles);
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

// Import Third-party Dependencies
import type { Input } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { EditorState } from "../app/state/index.ts";
import type {
  EditorScene,
  EditorSceneHandles
} from "../app/EditorScene.ts";
import {
  EditorSidebar
} from "../app/EditorSidebar.ts";
import type { ViewFocus } from "../scene/index.ts";
import type { EventCanvasHoverChange } from "../shared/domEvents.ts";
import type { EditorTextureRoom } from "./EditorSession.ts";

export interface EditorShellOptions {
  state: EditorState;
  viewFocus: ViewFocus;
  input: Input;
  scene: EditorScene;
  textureRoom?: EditorTextureRoom;
}

export class EditorShell {
  #sidebar: EditorSidebar | null = null;
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

    const activityLog = document.querySelector("jolly-log");
    if (activityLog) {
      activityLog.entries = state.log.entries;
      this.#disposables.push(
        state.log.subscribe((entries) => {
          activityLog.entries = entries;
        })
      );
    }

    const sidebar = document.querySelector("#sidebar");
    if (sidebar instanceof EditorSidebar) {
      this.#sidebar = sidebar;

      function onCanvasHoverChange(event: EventCanvasHoverChange) {
        input.keyboard.enabled = !event.detail.hovering;
      }

      sidebar.state = state;
      sidebar.viewFocus = viewFocus;
      sidebar.textureRoom = textureRoom;
      sidebar.onLoadWorld = (data) => scene.loadWorld(data);
      sidebar.onTeleportToPeer = (clientId) => {
        scene.teleportToPeer(clientId);
      };
      sidebar.addEventListener("canvas-hover-change", onCanvasHoverChange);
      this.#disposables.push(
        () => sidebar.removeEventListener(
          "canvas-hover-change",
          onCanvasHoverChange
        )
      );
    }
  }

  adoptHandles(
    handles: EditorSceneHandles
  ): void {
    if (this.#sidebar === null) {
      return;
    }

    this.#sidebar.engine = handles.engine;
    this.#sidebar.gridRenderer = handles.gridRenderer;
    this.#sidebar.localBrush = handles.localBrush;
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

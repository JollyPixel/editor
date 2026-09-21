// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../scene/EditorScene.ts";
import { EditorPanels } from "../app/panels/index.ts";

// CONSTANTS
const kCanvasHoverEvent = "canvas-hover-change";

export interface EditorShellOptions {
  state: EditorState;
  runtime: EditorRuntime;
}

export class EditorShell {
  #panels: EditorPanels | null;
  #toolbar: HTMLElementTagNameMap["voxel-brush-toolbar"] | null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const { state, runtime } = options;

    const activityLog = document.querySelector("jolly-log");
    if (activityLog) {
      activityLog.entries = state.log.entries;
      this.#disposables.push(
        state.log.subscribe((entries) => {
          activityLog.entries = entries;
        })
      );
    }

    this.#toolbar = document.querySelector("voxel-brush-toolbar");

    const panels = EditorPanels.mount(document);
    this.#panels = panels;
    if (panels !== null) {
      this.#disposables.push(
        runtime.suspendKeyboardOnHover(panels.layout, kCanvasHoverEvent),
        () => panels.dispose()
      );
    }
  }

  get layout(): HTMLElementTagNameMap["jolly-dock-layout"] | null {
    return this.#panels?.layout ?? null;
  }

  adoptWorkspace(
    workspace: VoxelMapWorkspace
  ): void {
    this.#panels?.attach(workspace);
    this.#toolbar?.attach(workspace);
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

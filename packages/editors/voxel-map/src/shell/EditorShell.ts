// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";
import { CANVAS_HOVER_CHANGE_EVENT } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { EditorPanels } from "./EditorPanels.ts";
import "./toolbar/EditToolbar.ts";
import "./paneIcons.ts";

export interface EditorShellOptions {
  state: EditorState;
  runtime: EditorRuntime;
}

export class EditorShell {
  #panels: EditorPanels | null;
  #toolbar: HTMLElementTagNameMap["voxel-edit-toolbar"] | null;
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

    this.#toolbar = document.querySelector("voxel-edit-toolbar");

    const panels = EditorPanels.mount(document);
    this.#panels = panels;
    if (panels !== null) {
      this.#disposables.push(
        runtime.suspendKeyboardOnHover(panels.layout, CANVAS_HOVER_CHANGE_EVENT),
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
    if (this.#toolbar !== null) {
      this.#toolbar.workspace = workspace;
    }
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

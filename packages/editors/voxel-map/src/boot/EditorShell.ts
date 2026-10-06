// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";
import { CANVAS_HOVER_CHANGE_EVENT } from "@jolly-pixel/editor.pixel-art";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import type { WorkspaceElement } from "../workspace/WorkspaceElement.ts";
import { EditorPanels } from "../app/panels/EditorPanels.ts";
import "../features/painting/toolbar/BrushToolbar.ts";
import "../features/placement/PlacementToolbar.ts";

export interface EditorShellOptions {
  state: EditorState;
  runtime: EditorRuntime;
}

export class EditorShell {
  #panels: EditorPanels | null;
  #toolbars: Array<WorkspaceElement>;
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

    this.#toolbars = [
      document.querySelector("voxel-brush-toolbar"),
      document.querySelector("voxel-placement-toolbar")
    ].filter((toolbar) => toolbar !== null);

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
    for (const toolbar of this.#toolbars) {
      toolbar.workspace = workspace;
    }
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

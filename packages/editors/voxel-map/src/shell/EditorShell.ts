// Import Third-party Dependencies
import {
  bindPresenceStack,
  type EditorRuntime,
  type EditorToolbarSources
} from "@jolly-pixel/editor.host";
import { CANVAS_HOVER_CHANGE_EVENT } from "@jolly-pixel/editor.pixel-art";
import type { PresenceStack } from "@jolly-pixel/ui";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import type { EditorState } from "../state/index.ts";
import type { VoxelMapEditing } from "../editing/VoxelMapEditing.ts";
import { EditorPanels } from "./EditorPanels.ts";
import "./toolbar/EditToolbar.ts";
import "./paneIcons.ts";

export interface EditorShellOptions {
  state: EditorState;
  runtime: EditorRuntime;
  toolbar: EditorToolbarSources;
}

export class EditorShell {
  #panels: EditorPanels | null;
  #toolbar: HTMLElementTagNameMap["voxel-edit-toolbar"] | null;
  #presenceStack: PresenceStack | null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const { state, runtime, toolbar } = options;

    const editorToolbar = document.querySelector("jolly-editor-toolbar");
    if (editorToolbar) {
      editorToolbar.sources = toolbar;
    }

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
    this.#presenceStack = document.querySelector("jolly-presence-stack");

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

  adoptEditing(
    editing: VoxelMapEditing
  ): void {
    this.#panels?.attach(editing);
    if (this.#presenceStack !== null) {
      this.#disposables.push(bindPresenceStack(
        this.#presenceStack,
        editing.state.presence,
        (clientId) => editing.teleportToPeer(clientId)
      ));
    }
    if (this.#toolbar !== null) {
      this.#toolbar.editing = editing;
    }
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
  }
}

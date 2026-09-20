// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { LeftPanel } from "../app/LeftPanel.ts";
import type { RightPanel } from "../app/RightPanel.ts";
import type { ModelWorkspace } from "../scene/index.ts";
import type { ModelTexture } from "./modelTexture.ts";

// CONSTANTS
const kCanvasHoverEvent = "canvas-hover-change";
const kLeftPanelSelector = "jolly-model-editor-left-panel";
const kRightPanelSelector = "jolly-model-editor-right-panel";

export interface EditorShellOptions {
  runtime: EditorRuntime;
  texture: ModelTexture;
}

export class EditorShell {
  #leftPanel: LeftPanel;
  #rightPanel: RightPanel;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const { runtime, texture } = options;

    const leftPanel = document.querySelector<LeftPanel>(
      kLeftPanelSelector
    );
    const rightPanel = document.querySelector<RightPanel>(
      kRightPanelSelector
    );
    if (leftPanel === null || rightPanel === null) {
      throw new Error("EditorShell: the editor panels are missing from the page.");
    }

    this.#leftPanel = leftPanel;
    this.#rightPanel = rightPanel;

    this.#leftPanel.setTexture(texture);
    this.#disposables.push(
      runtime.suspendKeyboardOnHover(
        this.#leftPanel,
        kCanvasHoverEvent
      )
    );
  }

  adoptWorkspace(
    workspace: ModelWorkspace
  ): void {
    void this.#rightPanel.attach(workspace);
    this.#leftPanel.onPeerUvDragging = (payload) => {
      workspace.textures.previewPeerDrag(payload);
    };
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
  }
}

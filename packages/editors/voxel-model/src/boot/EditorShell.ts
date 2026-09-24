// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";
import type { DockLayout } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LeftPanel } from "../app/LeftPanel.ts";
import type { RightPanel } from "../app/RightPanel.ts";
import { visibleTexturePane } from "../app/texturePanes.ts";
import type { ModelWorkspace } from "../scene/ModelEditorScene.ts";
import type { ModelTexture } from "./modelTexture.ts";

// CONSTANTS
const kCanvasHoverEvent = "canvas-hover-change";
const kLayoutSelector = "jolly-dock-layout";
const kLayoutEvents = ["jolly-layout-change", "jolly-pane-visibility"];
const kLeftPanelSelector = "jolly-model-editor-left-panel";
const kRightPanelSelector = "jolly-model-editor-right-panel";

export interface EditorShellOptions {
  runtime: EditorRuntime;
  texture: ModelTexture;
}

export class EditorShell {
  #layout: DockLayout;
  #leftPanel: LeftPanel;
  #rightPanel: RightPanel;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const { runtime, texture } = options;

    const layout = document.querySelector(kLayoutSelector);
    const leftPanel = document.querySelector<LeftPanel>(
      kLeftPanelSelector
    );
    const rightPanel = document.querySelector<RightPanel>(
      kRightPanelSelector
    );
    if (
      layout === null ||
      leftPanel === null ||
      rightPanel === null
    ) {
      throw new Error("EditorShell: the editor panels are missing from the page.");
    }

    this.#layout = layout;
    this.#leftPanel = leftPanel;
    this.#rightPanel = rightPanel;

    this.#leftPanel.setTexture(texture);
    for (const type of kLayoutEvents) {
      layout.addEventListener(type, this.#placeLeftPanel);
      this.#disposables.push(
        () => layout.removeEventListener(type, this.#placeLeftPanel)
      );
    }
    void layout.updateComplete.then(this.#placeLeftPanel);
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

  readonly #placeLeftPanel = (): void => {
    const pane = visibleTexturePane(
      (candidate) => this.#layout.paneVisible(candidate),
      this.#leftPanel.mode
    );
    const host = this.#layout.querySelector(`jolly-pane[key="${pane}"]`);
    if (host === null) {
      return;
    }

    if (this.#leftPanel.parentElement !== host) {
      host.append(this.#leftPanel);
    }
    this.#leftPanel.mode = pane;
  };

  dispose(): void {
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
  }
}

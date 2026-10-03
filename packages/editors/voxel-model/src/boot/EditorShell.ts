// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";
import { CANVAS_HOVER_CHANGE_EVENT } from "@jolly-pixel/editor.pixel-art";
import type {
  DockLayout,
  PaneElement
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  LeftPanel,
  LeftPanelTexture
} from "../app/LeftPanel.ts";
import type { RightPanel } from "../app/RightPanel.ts";
import { visibleTexturePane } from "../app/texturePanes.ts";
import { SHOW_MATERIAL_EVENT } from "../features/hierarchy/HierarchyPanel.ts";
import type { MaterialLibrary } from "../features/material/MaterialLibrary.ts";
import type { ModelWorkspace } from "../scene/ModelEditorScene.ts";

// CONSTANTS
const kLayoutSelector = "jolly-dock-layout";
const kLayoutEvents = ["jolly-layout-change", "jolly-pane-visibility"];
const kLeftPanelSelector = "jolly-model-editor-left-panel";
const kRightPanelSelector = "jolly-model-editor-right-panel";
const kMaterialLibrarySelector = "jolly-model-editor-material-library";
const kMaterialPane = "material";
const kBuildPane = "build";

export interface EditorShellOptions {
  runtime: EditorRuntime;
  texture: LeftPanelTexture;
}

export class EditorShell {
  #layout: DockLayout;
  #leftPanel: LeftPanel;
  #rightPanel: RightPanel;
  #materialPane: PaneElement;
  #materialLibrary: MaterialLibrary;
  #workspace: ModelWorkspace | null = null;
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
    const materialPane = layout?.querySelector<PaneElement>(
      `jolly-pane[key="${kMaterialPane}"]`
    );
    const materialLibrary = materialPane?.querySelector<MaterialLibrary>(
      kMaterialLibrarySelector
    );
    if (
      layout === null ||
      leftPanel === null ||
      rightPanel === null ||
      !materialPane ||
      !materialLibrary
    ) {
      throw new Error("EditorShell: the editor panels are missing from the page.");
    }

    this.#layout = layout;
    this.#leftPanel = leftPanel;
    this.#rightPanel = rightPanel;
    this.#materialPane = materialPane;
    this.#materialLibrary = materialLibrary;

    this.#leftPanel.setTexture(texture);
    for (const type of kLayoutEvents) {
      layout.addEventListener(type, this.#onLayoutChange);
      this.#disposables.push(
        () => layout.removeEventListener(type, this.#onLayoutChange)
      );
    }
    void layout.updateComplete.then(this.#onLayoutChange);
    rightPanel.addEventListener(SHOW_MATERIAL_EVENT, this.#showMaterialPane);
    this.#disposables.push(
      () => rightPanel.removeEventListener(
        SHOW_MATERIAL_EVENT,
        this.#showMaterialPane
      ),
      runtime.suspendKeyboardOnHover(
        this.#leftPanel,
        CANVAS_HOVER_CHANGE_EVENT
      )
    );
  }

  adoptWorkspace(
    workspace: ModelWorkspace
  ): void {
    this.#workspace = workspace;
    void this.#rightPanel.attach(workspace);
    this.#leftPanel.workspace = workspace;
    this.#syncGizmo();
    this.#materialLibrary.attach(workspace);
    this.#materialPane.presence = workspace.fields;
    this.#leftPanel.onPeerUvDragging = (region) => {
      workspace.textures.previewPeerDrag(region);
    };
  }

  readonly #showMaterialPane = (): void => {
    this.#layout.showPane(kMaterialPane);
  };

  readonly #onLayoutChange = (): void => {
    this.#placeLeftPanel();
    this.#syncGizmo();
  };

  #syncGizmo(): void {
    if (this.#workspace !== null) {
      this.#workspace.gizmo.enabled = this.#layout.paneVisible(kBuildPane);
    }
  }

  #placeLeftPanel(): void {
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
  }

  dispose(): void {
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
  }
}

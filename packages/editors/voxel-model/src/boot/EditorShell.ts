// Import Third-party Dependencies
import type { EditorRuntime } from "@jolly-pixel/editor.host";
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type KeyBindingSettings
} from "@jolly-pixel/editor.pixel-art";
import type {
  DockLayout,
  PaneElement,
  PaneGroup
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  LeftPanel,
  LeftPanelTexture
} from "../app/LeftPanel.ts";
import { visibleTexturePane } from "../app/texturePanes.ts";
import {
  SHOW_BUILD_EVENT,
  SHOW_MATERIAL_EVENT
} from "../features/hierarchy/HierarchyPanel.ts";
import {
  EDITOR_TABS,
  type EditorTab
} from "../state/index.ts";
import type { ModelWorkspace } from "../scene/ModelEditorScene.ts";

// CONSTANTS
const kLayoutSelector = "jolly-dock-layout";
const kLayoutEvents = ["jolly-layout-change", "jolly-pane-visibility"];
const kLeftPanelSelector = "jolly-model-editor-left-panel";
const kRightPanelSelector = "jolly-model-editor-right-panel";
const kAnimatePanelSelector = "jolly-model-editor-animate-panel";
const kTimelineDockSelector = "jolly-dock[key=\"timeline\"]";
const kAttachedTags = [
  kRightPanelSelector,
  "jolly-model-editor-material-library",
  "jolly-model-editor-history",
  kAnimatePanelSelector,
  "jolly-model-editor-timeline",
  "jolly-model-editor-animating-frame",
  "jolly-model-editor-timeline-transport"
] as const satisfies readonly (keyof HTMLElementTagNameMap)[];
const kAnimatePane = "animate";
const kMaterialPane = "material";
const kBuildPane = "build";

type WorkspaceElement = HTMLElementTagNameMap[typeof kAttachedTags[number]];

export interface EditorShellOptions {
  runtime: EditorRuntime;
  texture: LeftPanelTexture;
  keyBindingSettings: KeyBindingSettings;
}

export class EditorShell {
  #layout: DockLayout;
  #leftPanel: LeftPanel;
  #materialPane: PaneElement;
  #animateTabs: PaneGroup;
  #timelineDock: HTMLElement;
  #attached: WorkspaceElement[];
  #workspace: ModelWorkspace | null = null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const {
      runtime,
      texture,
      keyBindingSettings
    } = options;

    const layout = document.querySelector(kLayoutSelector);
    const leftPanel = document.querySelector<LeftPanel>(kLeftPanelSelector);
    const rightPanel = document.querySelector(kRightPanelSelector);
    const materialPane = layout?.querySelector<PaneElement>(
      `jolly-pane[key="${kMaterialPane}"]`
    );
    const animateTabs = document
      .querySelector(kAnimatePanelSelector)
      ?.closest<PaneGroup>("jolly-pane-group");
    const timelineDock = document.querySelector<HTMLElement>(kTimelineDockSelector);
    if (
      layout === null ||
      leftPanel === null ||
      rightPanel === null ||
      timelineDock === null ||
      !animateTabs ||
      !materialPane
    ) {
      throw new Error("EditorShell: the editor panels are missing from the page.");
    }

    this.#layout = layout;
    this.#leftPanel = leftPanel;
    this.#materialPane = materialPane;
    this.#animateTabs = animateTabs;
    this.#timelineDock = timelineDock;
    this.#attached = kAttachedTags.map(queryWorkspaceElement);

    this.#leftPanel.setTexture(texture);
    this.#leftPanel.keyBindingSettings = keyBindingSettings;
    for (const type of kLayoutEvents) {
      layout.addEventListener(type, this.#onLayoutChange);
      this.#disposables.push(
        () => layout.removeEventListener(type, this.#onLayoutChange)
      );
    }
    void layout.updateComplete.then(this.#onLayoutChange);
    rightPanel.addEventListener(SHOW_MATERIAL_EVENT, this.#showMaterialPane);
    rightPanel.addEventListener(SHOW_BUILD_EVENT, this.#showBuildPane);
    this.#disposables.push(
      () => rightPanel.removeEventListener(
        SHOW_MATERIAL_EVENT,
        this.#showMaterialPane
      ),
      () => rightPanel.removeEventListener(
        SHOW_BUILD_EVENT,
        this.#showBuildPane
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
    for (const element of this.#attached) {
      void element.attach(workspace);
    }
    this.#leftPanel.workspace = workspace;
    this.#syncGizmo();
    this.#syncTab();
    this.#materialPane.presence = workspace.fields;
    this.#leftPanel.onPeerUvDragging = (region) => {
      workspace.textures.previewPeerDrag(region);
    };
  }

  readonly #showMaterialPane = (): void => {
    this.#layout.showPane(kMaterialPane);
  };

  readonly #showBuildPane = (): void => {
    this.#layout.showPane(kBuildPane);
  };

  readonly #onLayoutChange = (): void => {
    this.#placeLeftPanel();
    this.#syncGizmo();
    this.#syncTab();
  };

  #syncTab(): void {
    this.#timelineDock.hidden = !this.#animating;
    this.#workspace?.tab.activate(tabOf(this.#animateTabs.active));
  }

  get #animating(): boolean {
    return this.#animateTabs.active === kAnimatePane;
  }

  #syncGizmo(): void {
    if (this.#workspace !== null) {
      this.#workspace.gizmo.enabled = this.#animating || this.#layout.paneVisible(kBuildPane);
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

function queryWorkspaceElement(
  tag: typeof kAttachedTags[number]
): WorkspaceElement {
  const element = document.querySelector(tag);
  if (element === null) {
    throw new Error(`EditorShell: "${tag}" is missing from the page.`);
  }

  return element;
}

function tabOf(
  pane: string | null
): EditorTab {
  return EDITOR_TABS.find((tab) => tab === pane) ?? "build";
}

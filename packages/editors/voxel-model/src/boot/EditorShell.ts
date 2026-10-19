// Import Third-party Dependencies
import {
  bindPresenceStack,
  type EditorRuntime,
  type EditorToolbarSources
} from "@jolly-pixel/editor.host";
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type PixelArtKeyBindingSettings,
  type UvNetLibrary
} from "@jolly-pixel/editor.pixel-art";
import "@jolly-pixel/editor.host/ui";
import type {
  DockLayout,
  PaneElement,
  PaneGroup,
  PresenceStack
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
const kHierarchySelector = "jolly-model-editor-hierarchy";
const kAnimatePanelSelector = "jolly-model-editor-animate-panel";
const kTimelineDockSelector = "jolly-dock[key=\"timeline\"]";
const kPresenceStackSelector = "jolly-presence-stack";
const kAttachedTags = [
  kHierarchySelector,
  "jolly-model-editor-material-library",
  "jolly-model-editor-view",
  "jolly-model-editor-history",
  "jolly-model-editor-lighting-menu",
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
  keyBindingSettings: PixelArtKeyBindingSettings;
  uvNets: UvNetLibrary;
  toolbar: EditorToolbarSources;
}

export class EditorShell {
  #layout: DockLayout;
  #leftPanel: LeftPanel;
  #materialPane: PaneElement;
  #animateTabs: PaneGroup;
  #timelineDock: HTMLElement;
  #attached: WorkspaceElement[];
  #presenceStack: PresenceStack;
  #workspace: ModelWorkspace | null = null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const {
      runtime,
      texture,
      keyBindingSettings,
      uvNets,
      toolbar
    } = options;

    const editorToolbar = document.querySelector("jolly-editor-toolbar");
    if (editorToolbar) {
      editorToolbar.sources = toolbar;
    }

    const layout = document.querySelector(kLayoutSelector);
    const leftPanel = document.querySelector<LeftPanel>(kLeftPanelSelector);
    const hierarchy = document.querySelector(kHierarchySelector);
    const materialPane = layout?.querySelector<PaneElement>(
      `jolly-pane[key="${kMaterialPane}"]`
    );
    const animateTabs = document
      .querySelector(kAnimatePanelSelector)
      ?.closest<PaneGroup>("jolly-pane-group");
    const timelineDock = document.querySelector<HTMLElement>(kTimelineDockSelector);
    const presenceStack = document.querySelector(kPresenceStackSelector);
    if (
      layout === null ||
      leftPanel === null ||
      hierarchy === null ||
      timelineDock === null ||
      presenceStack === null ||
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
    this.#presenceStack = presenceStack;

    this.#leftPanel.showTexture(texture);
    this.#leftPanel.keyBindingSettings = keyBindingSettings;
    this.#leftPanel.uvNets = uvNets;
    for (const type of kLayoutEvents) {
      layout.addEventListener(type, this.#onLayoutChange);
      this.#disposables.push(
        () => layout.removeEventListener(type, this.#onLayoutChange)
      );
    }
    void layout.updateComplete.then(this.#onLayoutChange);
    hierarchy.addEventListener(SHOW_MATERIAL_EVENT, this.#showMaterialPane);
    hierarchy.addEventListener(SHOW_BUILD_EVENT, this.#showBuildPane);
    this.#disposables.push(
      () => hierarchy.removeEventListener(
        SHOW_MATERIAL_EVENT,
        this.#showMaterialPane
      ),
      () => hierarchy.removeEventListener(
        SHOW_BUILD_EVENT,
        this.#showBuildPane
      ),
      runtime.suspendKeyboardOnHover(
        this.#leftPanel,
        CANVAS_HOVER_CHANGE_EVENT
      )
    );
  }

  get layout(): DockLayout {
    return this.#layout;
  }

  adoptWorkspace(
    workspace: ModelWorkspace
  ): void {
    this.#workspace = workspace;
    for (const element of this.#attached) {
      void element.attach(workspace);
    }
    this.#disposables.push(bindPresenceStack(
      this.#presenceStack,
      workspace.presence,
      (clientId) => workspace.teleportToPeer(clientId)
    ));
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
    this.#workspace?.tab.activate(parseEditorTab(this.#animateTabs.active));
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

function parseEditorTab(
  pane: string | null
): EditorTab {
  return EDITOR_TABS.find((tab) => tab === pane) ?? "build";
}

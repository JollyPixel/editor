// Import Third-party Dependencies
import type {
  EditorRuntime,
  EditorToolbarSources,
  HostLogger
} from "@jolly-pixel/editor.host";
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type PixelArtAction,
  type UvNetLibrary
} from "@jolly-pixel/editor.pixel-art";
import type { KeyBindingSettings } from "@jolly-pixel/controls";
import "@jolly-pixel/editor.host/ui";
import {
  bindPresenceStack,
  type DockLayout,
  type PaneElement,
  type PaneGroup,
  type PresenceStack
} from "@jolly-pixel/ui";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  LeftPanel,
  LeftPanelTexture
} from "../app/LeftPanel.ts";
import {
  SHOW_MATERIAL_EVENT,
  SHOW_TEXTURE_EVENT
} from "../features/hierarchy/HierarchyPanel.ts";
import {
  EDITOR_TABS,
  type EditorTab
} from "../state/index.ts";
import type { ModelEditing } from "../scene/ModelEditorScene.ts";

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
  "jolly-model-editor-viewport-toolbar",
  "jolly-model-editor-lighting-menu",
  kAnimatePanelSelector,
  "jolly-model-editor-timeline",
  "jolly-model-editor-animating-frame",
  "jolly-model-editor-timeline-transport"
] as const satisfies readonly (keyof HTMLElementTagNameMap)[];
const kAnimatePane = "animate";
const kMaterialPane = "material";
const kTexturePane = "texture";

type AttachedElement = HTMLElementTagNameMap[typeof kAttachedTags[number]];

export interface EditorShellOptions {
  runtime: EditorRuntime;
  texture: LeftPanelTexture;
  keyBindingSettings: KeyBindingSettings<PixelArtAction>;
  uvNets: UvNetLibrary;
  toolbar: EditorToolbarSources;
  logger: HostLogger;
}

export class EditorShell {
  #layout: DockLayout;
  #leftPanel: LeftPanel;
  #materialPane: PaneElement;
  #animateTabs: PaneGroup;
  #timelineDock: HTMLElement;
  #attached: AttachedElement[];
  #presenceStack: PresenceStack;
  #logger: HostLogger;
  #editing: ModelEditing | null = null;
  #disposables: Array<() => void> = [];

  constructor(
    options: EditorShellOptions
  ) {
    const {
      runtime,
      texture,
      keyBindingSettings,
      uvNets,
      toolbar,
      logger
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
    this.#attached = kAttachedTags.map(queryAttachedElement);
    this.#presenceStack = presenceStack;
    this.#logger = logger;

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
    hierarchy.addEventListener(SHOW_TEXTURE_EVENT, this.#showTexturePane);
    this.#disposables.push(
      () => hierarchy.removeEventListener(
        SHOW_MATERIAL_EVENT,
        this.#showMaterialPane
      ),
      () => hierarchy.removeEventListener(
        SHOW_TEXTURE_EVENT,
        this.#showTexturePane
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

  adoptEditing(
    editing: ModelEditing
  ): void {
    this.#editing = editing;
    for (const element of this.#attached) {
      if (element.matches(":defined")) {
        void element.attach(editing);
      }
      else {
        void customElements.whenDefined(element.localName).then(() => {
          if (this.#editing === editing) {
            void element.attach(editing);
          }
        });
      }
    }
    this.#disposables.push(bindPresenceStack(
      this.#presenceStack,
      editing.presence,
      (clientId) => editing.teleportToPeer(clientId)
    ));
    this.#leftPanel.editing = editing;
    this.#syncTab();
    this.#materialPane.fieldLocks = editing.fields;
    this.#leftPanel.onPeerUvDragging = (region) => {
      editing.textures.previewPeerDrag(region);
    };
  }

  readonly #showMaterialPane = (): void => {
    this.#layout.showPane(kMaterialPane);
  };

  readonly #showTexturePane = (): void => {
    this.#layout.showPane(kTexturePane);
  };

  readonly #onLayoutChange = (): void => {
    this.#loadVisiblePanels();
    this.#syncTab();
  };

  #loadVisiblePanels(): void {
    const loads: Promise<unknown>[] = [];
    if (this.#layout.paneVisible(kMaterialPane)) {
      loads.push(import("../features/material/MaterialLibrary.ts"));
    }
    if (this.#animating) {
      loads.push(
        import("../features/animation/AnimatePanel.ts"),
        import("../features/animation/timeline/Timeline.ts")
      );
    }
    void Promise.all(loads).catch((error: unknown) => {
      this.#logger.warn(
        `An editor panel failed to load: ${errorMessage(error)}`
      );
    });
  }

  #syncTab(): void {
    this.#timelineDock.hidden = !this.#animating;
    if (this.#editing !== null) {
      const { tab, gizmo } = this.#editing;
      tab.activate(parseEditorTab(this.#animateTabs.active));
      gizmo.enabled = tab.transforming;
    }
  }

  get #animating(): boolean {
    return this.#animateTabs.active === kAnimatePane;
  }

  dispose(): void {
    this.#editing = null;
    for (const dispose of this.#disposables.splice(0).reverse()) {
      dispose();
    }
  }
}

function queryAttachedElement(
  tag: typeof kAttachedTags[number]
): AttachedElement {
  const element = document.querySelector(tag);
  if (element === null) {
    throw new Error(`EditorShell: "${tag}" is missing from the page.`);
  }

  return element;
}

function parseEditorTab(
  pane: string | null
): EditorTab {
  return EDITOR_TABS.find((tab) => tab === pane) ?? "texture";
}

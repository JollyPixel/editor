// Import Third-party Dependencies
import { LitElement, css, html, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import {
  findParentId,
  resolveReparent,
  showPrompt,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type ModelManager from "../three/ModelManager.ts";
import type GroupManager from "../three/GroupManager.ts";
import type ThreeSceneManager from "../three/ThreeSceneManager.ts";

export class RightPanel extends LitElement {
  private modelManager: ModelManager | null = null;
  private sceneManager: ThreeSceneManager | null = null;

  @state()
  private declare nodes: TreeNode[];

  @state()
  private declare selected: string[];

  @state()
  private declare expanded: string[];

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      font: inherit;
    }

    jolly-toolbar {
      padding: var(--jolly-space-2, 8px);
    }

    jolly-tree {
      flex: 1 1 auto;
      overflow: auto;
      padding-inline: var(--jolly-space-1, 4px);
    }
  `;

  constructor() {
    super();

    this.nodes = [];
    this.selected = [];
    this.expanded = [];
  }

  override firstUpdated(): void {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener("groupCreated", (e: Event) => {
      const event = e as CustomEvent;
      const { group, name } = event.detail;
      this.addGroupItemToUI(group, name || "Cube");
    });

    document.addEventListener("groupSelected", (e: Event) => {
      const event = e as CustomEvent;
      const { group } = event.detail;
      const uuid = group ? group.getGroupUUID() : null;
      this.setSelectedItemInUI(uuid);
    });
  }

  private handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this.selected = event.detail.selected;

    if (this.selected.length === 0) {
      this.modelManager?.selectGroup(null);

      return;
    }

    if (!this.modelManager) {
      return;
    }

    const group = this.modelManager.getGroupByUUID(this.selected[0]);
    if (group) {
      this.modelManager.selectGroup(group);
    }
  };

  private handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    const { id, expanded } = event.detail;
    this.expanded = expanded ?
      [...this.expanded, id] :
      this.expanded.filter((expandedId) => expandedId !== id);
  };

  /**
   * The tree is the source of truth for hierarchy; the 3D scene follows it,
   * not the other way round. `resolveReparent` already ran the structural
   * guard, so a moved id landing under a new parent here can't be a cycle.
   */
  private handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const { movedIds, targetId, where } = event.detail;
    const nextNodes = resolveReparent({ nodes: this.nodes, movedIds, targetId, where });
    if (nextNodes === this.nodes) {
      return;
    }

    this.nodes = nextNodes;

    for (const movedId of movedIds) {
      this.modelManager?.reparent(movedId, findParentId(nextNodes, movedId) ?? null);
    }

    if (where === "inside" && !this.expanded.includes(targetId)) {
      this.expanded = [...this.expanded, targetId];
    }
  };

  public setModelManager(modelManager: ModelManager): void {
    this.modelManager = modelManager;
  }

  public setSceneManager(sceneManager: ThreeSceneManager): void {
    this.sceneManager = sceneManager;
  }

  public addGroupItemToUI(group: GroupManager, label: string = "Cube"): void {
    this.nodes = [
      ...this.nodes,
      { id: group.getGroupUUID(), label }
    ];
  }

  public setSelectedItemInUI(uuid: string | null): void {
    this.selected = uuid ? [uuid] : [];
  }

  private handleAddCube(): void {
    void this.promptAddCube();
  }

  private async promptAddCube(): Promise<void> {
    this.sceneManager?.setControlsEnabled(false);
    const name = await showPrompt({
      title: "New Cube",
      label: "Cube name",
      defaultValue: "Cube"
    });
    this.sceneManager?.setControlsEnabled(true);

    if (name !== null) {
      this.createCubeWithName(name || "Cube");
    }
  }

  private createCubeWithName(name: string): void {
    const event = new CustomEvent("addcube", {
      detail: { name },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  override render(): TemplateResult {
    return html`
      <jolly-toolbar label="Actions">
        <jolly-button @click=${this.handleAddCube}>Add Cube</jolly-button>
        <jolly-button>Duplicate</jolly-button>
      </jolly-toolbar>
      <jolly-tree
        .nodes=${this.nodes}
        .selected=${this.selected}
        .expanded=${this.expanded}
        multiple
        reorderable
        row-drag
        @jolly-select=${this.handleSelect}
        @jolly-toggle-expand=${this.handleToggleExpand}
        @jolly-reparent=${this.handleReparent}
      ></jolly-tree>
    `;
  }
}

customElements.define("jolly-model-editor-right-panel", RightPanel);

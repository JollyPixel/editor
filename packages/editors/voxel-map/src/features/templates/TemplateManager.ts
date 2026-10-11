// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import {
  startPointerDragSession,
  type JollyActivateDetail,
  type JollyRenameDetail,
  type JollySelectDetail,
  type PointerDragSessionHandle,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { treeHostStyles } from "../../shared/styles/treeHost.styles.ts";
import { templateTreeNodes } from "./templateTree.ts";
import { TemplateDrop } from "./TemplateDrop.ts";
import "./TemplatePanel.ts";
import "./templateIcons.ts";

// CONSTANTS
const kDragThreshold = 4;
const kDraggingClass = "template-dragging";

@customElement("template-manager")
export class TemplateManager extends WorkspaceElement {
  static override styles = [
    treeHostStyles,
    css`
      :host {
        display: block;
      }

      .tree-host {
        max-height: 160px;
      }
    `
  ];

  @state()
  private declare _nodes: TreeNode<string>[];

  @state()
  private declare _selected: string | null;

  @state()
  private declare _canSave: boolean;

  #drag: PointerDragSessionHandle | null = null;

  constructor() {
    super();
    this._nodes = [];
    this._selected = null;
    this._canSave = false;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { templates, mapDocument } = workspace;
    const { selection } = workspace.state;
    const refresh = (): void => {
      this._nodes = templateTreeNodes(workspace.mapDocument.world.templates);
    };
    this._selected = templates.store.selected;
    this._canSave = selection.voxelLayer !== null;
    refresh();

    return [
      mapDocument.subscribe("templatesChanged", refresh),
      mapDocument.subscribe("reset", refresh),
      templates.store.subscribe("selectionChange", (templateId) => {
        this._selected = templateId;
      }),
      selection.subscribe("change", () => {
        this._canSave = selection.voxelLayer !== null;
      }),
      workspace.access.subscribe("change", () => this.requestUpdate()),
      () => this.#drag?.cancel()
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    const { templates, placement } = workspace;

    return html`
      <jolly-folder
        key="templates"
        label="Templates"
        storage-key="voxel-map:folder:templates"
      >
        <jolly-button
          slot="actions"
          icon="template-save"
          icon-only
          label="Save layer as template"
          title="Save the selected voxel layer as a template"
          ?disabled=${!templates.editable || !this._canSave}
          @click=${this.#saveTemplate}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="template-place"
          icon-only
          label="Place template"
          title="Place the selected template in the world"
          ?disabled=${!placement.canPlace("template") || this._selected === null}
          @click=${this.#place}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Delete template"
          title="Delete template"
          ?disabled=${!templates.editable || this._selected === null}
          @click=${this.#removeTemplate}
        ></jolly-button>

        <div class="tree-host">${this.#renderTree(templates.editable)}</div>
        <template-panel
          .world=${workspace.mapDocument.world}
          .templates=${templates}
          .placement=${placement}
          .mapDocument=${workspace.mapDocument}
        ></template-panel>
      </jolly-folder>
    `;
  }

  #renderTree(
    renamable: boolean
  ) {
    if (this._nodes.length === 0) {
      return html`<p class="hint">
        Select a voxel layer and save it to create a template.
      </p>`;
    }

    return html`
      <jolly-tree
        .renamable=${renamable}
        .nodes=${this._nodes}
        .selected=${this._selected === null ? [] : [this._selected]}
        @jolly-select=${this.#onSelect}
        @jolly-rename=${this.#onRename}
        @jolly-activate=${this.#onActivate}
        @pointerdown=${this.#onTreePointerDown}
      ></jolly-tree>
    `;
  }

  readonly #saveTemplate = (): void => {
    const workspace = this.workspace;
    const layerName = workspace?.state.selection.voxelLayer ?? null;
    if (workspace === null || layerName === null) {
      return;
    }

    const templateId = workspace.templates.saveLayer(layerName);
    if (templateId === null) {
      workspace.state.log.push(`${layerName} has no voxels to save as a template`);
    }
  };

  readonly #place = (): void => {
    const workspace = this.workspace;
    const templateId = workspace?.templates.store.selected ?? null;
    if (workspace === null || templateId === null) {
      return;
    }

    workspace.placement.placeTemplate(templateId, workspace.focusPoint());
  };

  readonly #removeTemplate = async(): Promise<void> => {
    const workspace = this.workspace;
    if (workspace !== null && this._selected !== null) {
      await workspace.templates.remove(this._selected);
    }
  };

  #onSelect(
    event: CustomEvent<JollySelectDetail>
  ): void {
    const [id] = event.detail.selected;
    if (this.workspace !== null) {
      this.workspace.templates.store.selected = id ?? null;
    }
  }

  #onRename(
    event: CustomEvent<JollyRenameDetail>
  ): void {
    const workspace = this.workspace;
    if (workspace === null) {
      return;
    }

    workspace.templates.rename(event.detail.id, event.detail.name);
    this._nodes = templateTreeNodes(workspace.mapDocument.world.templates);
  }

  #onActivate(
    event: CustomEvent<JollyActivateDetail>
  ): void {
    if (this.workspace !== null) {
      this.workspace.templates.store.selected = event.detail.id;
      this.#place();
    }
  }

  #onTreePointerDown(
    event: PointerEvent
  ): void {
    const workspace = this.workspace;
    const row = event.button === 0 ? createTemplateRow(event) : null;
    const templateId = row?.dataset.id;
    if (
      workspace === null ||
      row === null ||
      templateId === undefined ||
      !workspace.placement.canPlace("template")
    ) {
      return;
    }

    const drop = new TemplateDrop({
      templateId,
      placement: workspace.placement,
      pointAt: (clientX, clientY) => workspace.pointAt(clientX, clientY)
    });
    this.#drag?.cancel();
    this.#drag = startPointerDragSession({
      element: row,
      event,
      threshold: kDragThreshold,
      documentClass: kDraggingClass,
      onStart: () => {
        workspace.templates.store.selected = templateId;
      },
      onMove: (clientX, clientY) => drop.hover(clientX, clientY),
      onFinish: (result) => {
        this.#drag = null;
        drop.finish(result);
      }
    });
  }
}

function createTemplateRow(
  event: Event
): HTMLElement | null {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLInputElement) {
      return null;
    }
    if (
      target instanceof HTMLElement &&
      target.getAttribute("role") === "treeitem"
    ) {
      return target;
    }
  }

  return null;
}

declare global {
  interface HTMLElementTagNameMap {
    "template-manager": TemplateManager;
  }
}

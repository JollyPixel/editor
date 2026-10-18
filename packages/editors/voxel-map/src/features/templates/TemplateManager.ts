// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import {
  startPointerDragSession,
  type JollyActivateDetail,
  type JollyRenameDetail,
  type JollySelectDetail,
  type PointerDragSessionHandle,
  type TreeBadge,
  type TreeNode
} from "@jolly-pixel/ui";
import { peerBadges } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { TemplateDraftId } from "../../document/TemplateDraftId.ts";
import { VoxelLayerRef } from "../../state/index.ts";
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

      :host([drop-target]) {
        outline: 1px solid var(--jolly-accent-fill);
        outline-offset: -1px;
      }

      .tree-host {
        max-height: 160px;
      }
    `
  ];

  @property({
    type: Boolean,
    reflect: true,
    attribute: "drop-target"
  })
  declare dropTarget: boolean;

  @state()
  private declare _nodes: TreeNode<string>[];

  @state()
  private declare _selected: string | null;

  #drag: PointerDragSessionHandle | null = null;

  constructor() {
    super();
    this.dropTarget = false;
    this._nodes = [];
    this._selected = null;
  }

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { templates, mapDocument } = workspace;
    const refresh = (): void => this.#refreshNodes(workspace);
    this._selected = templates.store.selected;
    refresh();

    return [
      mapDocument.subscribe("templatesChanged", refresh),
      mapDocument.subscribe("layerUpdated", refresh),
      mapDocument.subscribe("reset", refresh),
      workspace.state.presence.subscribe("layerSelectionsChange", refresh),
      workspace.state.editContext.subscribe(
        "change",
        () => this.requestUpdate()
      ),
      templates.store.subscribe("selectionChange", (templateId) => {
        this._selected = templateId;
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

    const { templates, templateEditing, placement } = workspace;
    const editable = templateEditing.canOpen &&
      this._selected !== null &&
      this._selected !== workspace.state.editContext.draft?.templateId;

    return html`
      <jolly-folder
        key="templates"
        label="Templates"
        storage-key="voxel-map:folder:templates"
      >
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
          icon="pencil"
          icon-only
          label="Edit template"
          title="Edit the selected template with everyone in the room"
          ?disabled=${!editable}
          @click=${this.#edit}
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
        Drop a voxel layer here or save a selection to create a template.
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

  readonly #place = (): void => {
    const workspace = this.workspace;
    const templateId = workspace?.templates.store.selected ?? null;
    if (workspace === null || templateId === null) {
      return;
    }

    workspace.placement.placeTemplate(templateId, workspace.focusPoint());
  };

  readonly #edit = (): void => {
    if (this.workspace !== null && this._selected !== null) {
      this.workspace.templateEditing.open(this._selected);
    }
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
    this.#refreshNodes(workspace);
  }

  #refreshNodes(
    workspace: VoxelMapWorkspace
  ): void {
    const { world } = workspace.mapDocument;
    const marks = workspace.state.presence.layerSelections;
    const drafts = new Map<string, TreeBadge[]>();
    for (const layer of world.getLayers()) {
      const draft = TemplateDraftId.parse(layer.id);
      if (draft !== null) {
        drafts.set(
          draft.templateId,
          peerBadges(new VoxelLayerRef(layer.name).key, marks)
        );
      }
    }

    this._nodes = templateTreeNodes(world.templates, drafts);
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

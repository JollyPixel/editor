// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import type {
  JollyActivateDetail,
  JollyRenameDetail,
  JollySelectDetail,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { templateTreeNodes } from "./templateTree.ts";
import "./TemplatePanel.ts";

@customElement("template-manager")
export class TemplateManager extends WorkspaceElement {
  static override styles = css`
    :host {
      display: block;
    }

    .tree-host {
      max-height: 160px;
      overflow-y: auto;
    }

    jolly-tree {
      margin-inline: var(--jolly-space-1, 4px);
    }

    .hint {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted);
    }
  `;

  @state()
  private declare _nodes: TreeNode<string>[];

  @state()
  private declare _selected: string | null;

  @state()
  private declare _canSave: boolean;

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
      this._nodes = templateTreeNodes(workspace.view.document.world.templates);
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
      })
    ];
  }

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

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
          ?disabled=${!this._canSave}
          @click=${this.#saveTemplate}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="stamp"
          icon-only
          label="Place template"
          title="Place the selected template in the world"
          ?disabled=${this._selected === null}
          @click=${this.#place}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          variant="danger"
          label="Delete template"
          title="Delete template"
          ?disabled=${this._selected === null}
          @click=${this.#removeTemplate}
        ></jolly-button>

        ${this.#renderTree()}
        <template-panel
          .world=${workspace.view.document.world}
          .templates=${workspace.templates}
          .placement=${workspace.placement}
          .selection=${workspace.state.selection}
          .mapDocument=${workspace.mapDocument}
        ></template-panel>
      </jolly-folder>
    `;
  }

  #renderTree() {
    if (this._nodes.length === 0) {
      return html`<p class="hint">
        Select a voxel layer and save it to create a template.
      </p>`;
    }

    return html`
      <div class="tree-host">
        <jolly-tree
          renamable
          activate-on-double-click
          .nodes=${this._nodes}
          .selected=${this._selected === null ? [] : [this._selected]}
          @jolly-select=${this.#onSelect}
          @jolly-rename=${this.#onRename}
          @jolly-activate=${this.#onActivate}
        ></jolly-tree>
      </div>
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
    this._nodes = templateTreeNodes(workspace.view.document.world.templates);
  }

  #onActivate(
    event: CustomEvent<JollyActivateDetail>
  ): void {
    if (this.workspace !== null) {
      this.workspace.templates.store.selected = event.detail.id;
      this.#place();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "template-manager": TemplateManager;
  }
}

// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import type {
  ContextMenu,
  Tree
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../shared/actionIcons.ts";
import "./dialogs/HierarchyNameDialog.ts";
import "./dialogs/HierarchyDuplicateDialog.ts";
import "../../shared/DeleteDialog.ts";
import {
  HierarchyController,
  type HierarchyWorkspace
} from "./HierarchyController.ts";
import type { HierarchyNameDialog } from "./dialogs/HierarchyNameDialog.ts";
import type { HierarchyDuplicateDialog } from "./dialogs/HierarchyDuplicateDialog.ts";
import type { DeleteDialog } from "../../shared/DeleteDialog.ts";
import { ContextMenuController } from "../../shared/ContextMenuController.ts";

// CONSTANTS
export const SHOW_MATERIAL_EVENT = "show-material";

export class HierarchyPanel extends LitElement {
  #tree = new HierarchyController(this, {
    promptName: (context) => this.nameDialog.open(context),
    promptDuplicate: (context) => this.duplicateDialog.open(context),
    promptDelete: (context) => this.deleteDialog.open(context),
    beginRename: (id) => this.tree.beginRename(id),
    showMaterial: () => this.dispatchEvent(
      new CustomEvent(SHOW_MATERIAL_EVENT, {
        bubbles: true,
        composed: true
      })
    )
  });

  #menu = new ContextMenuController(
    () => this.rowMenu,
    (id) => this.#tree.menuFor(id)
  );

  @query("jolly-tree")
  declare private tree: Tree;

  @query("jolly-context-menu")
  declare private rowMenu: ContextMenu;

  @query("jolly-model-editor-name-dialog")
  declare private nameDialog: HierarchyNameDialog;

  @query("jolly-model-editor-duplicate-dialog")
  declare private duplicateDialog: HierarchyDuplicateDialog;

  @query("jolly-model-editor-delete-dialog")
  declare private deleteDialog: DeleteDialog;

  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    jolly-folder {
      flex: 1 1 auto;
      min-height: 0;
    }

    jolly-folder::part(header) {
      font-size: calc(var(--jolly-font-size, 11px) + 2px);
    }

    jolly-tree {
      flex: 1 1 auto;
      overflow: auto;
      padding-inline: var(--jolly-space-1, 4px);
    }

    jolly-tree::part(grip) {
      display: none;
    }
  `;

  attach(
    workspace: HierarchyWorkspace
  ): void {
    this.#tree.attach(workspace);
  }

  override render(): TemplateResult {
    return html`
      <jolly-folder
        key="hierarchy"
        label="Hierarchy"
        .collapsible=${false}
        flush
      >
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add Block"
          title="Add Block"
          @click=${this.#tree.addBlock}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="folder-add"
          icon-only
          label="Add Folder"
          title="Add Folder"
          @click=${this.#tree.addFolder}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="action-duplicate"
          icon-only
          label="Duplicate"
          title="Duplicate"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.duplicateSelected}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="action-delete"
          icon-only
          label="Delete"
          title="Delete"
          ?disabled=${!this.#tree.hasSelection}
          @click=${this.#tree.deleteSelected}
        ></jolly-button>
        <jolly-tree
          .nodes=${this.#tree.nodes}
          .selected=${this.#tree.selected}
          .expanded=${this.#tree.expanded}
          reorderable
          row-drag
          renamable
          @jolly-activate=${this.#tree.handleActivate}
          @jolly-activate-swatch=${this.#tree.handleActivateSwatch}
          @jolly-context-request=${this.#menu.onContextRequest}
          @jolly-select=${this.#tree.handleSelect}
          @jolly-toggle-expand=${this.#tree.handleToggleExpand}
          @jolly-rename=${this.#tree.handleRename}
          @jolly-reparent=${this.#tree.handleReparent}
        ></jolly-tree>
      </jolly-folder>
      <jolly-model-editor-name-dialog></jolly-model-editor-name-dialog>
      <jolly-model-editor-duplicate-dialog></jolly-model-editor-duplicate-dialog>
      <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
      <jolly-context-menu
        label="Hierarchy actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }
}

customElements.define("jolly-model-editor-hierarchy", HierarchyPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-hierarchy": HierarchyPanel;
  }
}

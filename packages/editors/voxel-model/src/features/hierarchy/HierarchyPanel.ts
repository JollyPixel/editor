// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import {
  type ContextMenu,
  type Tree,
  ContextMenuController,
  LazyTemplate
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/tree";

// Import Internal Dependencies
import "../../shared/actionIcons.ts";
import "./hierarchyIcons.ts";
import {
  HierarchyController,
  type HierarchyEditing
} from "./HierarchyController.ts";

// CONSTANTS
export const SHOW_MATERIAL_EVENT = "show-material";
export const SHOW_BUILD_EVENT = "show-build";

export class HierarchyPanel extends LitElement {
  #dialogs = new LazyTemplate(this, () => Promise.all([
    import("../../shared/dialogs/NameDialog.ts"),
    import("./dialogs/HierarchyDuplicateDialog.ts"),
    import("../../shared/dialogs/DeleteDialog.ts")
  ]));

  #tree = new HierarchyController(this, {
    promptName: (context) => this.#dialogs
      .query("jolly-model-editor-name-dialog")
      .then((dialog) => dialog.open(context)),
    promptDuplicate: (context) => this.#dialogs
      .query("jolly-model-editor-duplicate-dialog")
      .then((dialog) => dialog.open(context)),
    promptDelete: (context) => this.#dialogs
      .query("jolly-model-editor-delete-dialog")
      .then((dialog) => dialog.open(context)),
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
    (id) => this.#tree.openMenu(id)
  );

  @query("jolly-tree")
  declare private tree: Tree;

  @query("jolly-context-menu")
  declare private rowMenu: ContextMenu;
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
    editing: HierarchyEditing
  ): void {
    this.#tree.attach(editing);
  }

  readonly #showBuild = (): void => {
    this.dispatchEvent(new CustomEvent(SHOW_BUILD_EVENT, {
      bubbles: true,
      composed: true
    }));
  };

  override render(): TemplateResult {
    const editable = this.#tree.editable && this.#tree.writable;

    return html`
      <jolly-folder
        key="hierarchy"
        label="Hierarchy"
        .collapsible=${false}
        flush
      >
        ${this.#tree.editable ? this.#renderActions() : this.#renderLock()}
        <jolly-tree
          .nodes=${this.#tree.nodes}
          .selected=${this.#tree.selected}
          .expanded=${this.#tree.expanded}
          .validateRename=${this.#tree.validateRename}
          ?reorderable=${editable}
          ?row-drag=${editable}
          ?renamable=${editable}
          @jolly-activate=${this.#tree.handleActivate}
          @jolly-activate-swatch=${this.#tree.handleActivateSwatch}
          @jolly-context-request=${this.#tree.editable ? this.#menu.onContextRequest : nothing}
          @jolly-select=${this.#tree.handleSelect}
          @jolly-toggle-expand=${this.#tree.handleToggleExpand}
          @jolly-toggle-visible=${this.#tree.handleToggleVisible}
          @jolly-rename=${this.#tree.handleRename}
          @jolly-reparent=${this.#tree.handleReparent}
        ></jolly-tree>
      </jolly-folder>
      ${this.#dialogs.render(() => html`
        <jolly-model-editor-name-dialog></jolly-model-editor-name-dialog>
        <jolly-model-editor-duplicate-dialog></jolly-model-editor-duplicate-dialog>
        <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
      `)}
      <jolly-context-menu
        label="Hierarchy actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderLock(): TemplateResult {
    return html`
      <jolly-button
        slot="actions"
        icon="lock"
        icon-only
        label="Edit in Build"
        title="Edit the hierarchy in the Build tab"
        @click=${this.#showBuild}
      ></jolly-button>
    `;
  }

  #renderActions(): TemplateResult {
    const { writable } = this.#tree;
    const actOnSelection = writable && this.#tree.hasSelection;

    return html`
      <jolly-button
        slot="actions"
        icon="plus"
        icon-only
        label="Add Block"
        title="Add Block"
        ?disabled=${!writable}
        @click=${this.#tree.addBlock}
      ></jolly-button>
      <jolly-button
        slot="actions"
        icon="folder-add"
        icon-only
        label="Add Folder"
        title="Add Folder"
        ?disabled=${!writable}
        @click=${this.#tree.addFolder}
      ></jolly-button>
      <jolly-button
        slot="actions"
        icon="action-duplicate"
        icon-only
        label="Duplicate"
        title="Duplicate"
        ?disabled=${!actOnSelection}
        @click=${this.#tree.duplicateSelected}
      ></jolly-button>
      <jolly-button
        slot="actions"
        icon="action-delete"
        icon-only
        label="Delete"
        title="Delete"
        ?disabled=${!actOnSelection}
        @click=${this.#tree.deleteSelected}
      ></jolly-button>
    `;
  }
}

customElements.define("jolly-model-editor-hierarchy", HierarchyPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-hierarchy": HierarchyPanel;
  }
}

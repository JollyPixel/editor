// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  ContextMenuController,
  menuPointBelow,
  type ContextMenu,
  type Tree
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/tree";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import { HierarchyController } from "./HierarchyController.ts";

export class HierarchyPanel extends LitElement {
  #tree = new HierarchyController(this, {
    beginRename: (id) => this.#treeElement()?.beginRename(id)
  });

  #menu = new ContextMenuController(
    () => this.#contextMenu(),
    (id) => this.#tree.openMenu(id)
  );

  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    .actions {
      display: flex;
      gap: var(--jolly-space-1, 4px);
      padding: var(--jolly-space-1, 4px);
    }

    jolly-tree {
      flex: 1 1 auto;
      overflow: auto;
      padding-inline: var(--jolly-space-1, 4px);
    }
  `;

  attach(
    editing: SceneEditing
  ): void {
    this.#tree.attach(editing);
  }

  readonly #openAddMenu = (
    event: MouseEvent
  ): void => {
    this.#menu.open(this.#tree.addMenu(), menuPointBelow(event));
  };

  override render(): TemplateResult {
    const { hasSelection } = this.#tree;

    return html`
      <div class="actions">
        <jolly-button
          icon="plus"
          aria-haspopup="menu"
          @click=${this.#openAddMenu}
        >Add</jolly-button>
        <jolly-button
          icon="action-duplicate"
          icon-only
          label="Duplicate"
          title="Duplicate"
          ?disabled=${!hasSelection}
          @click=${this.#tree.duplicateSelected}
        ></jolly-button>
        <jolly-button
          icon="trash"
          icon-only
          label="Delete"
          title="Delete"
          ?disabled=${!hasSelection}
          @click=${this.#tree.deleteSelected}
        ></jolly-button>
      </div>
      <jolly-tree
        multiple
        reorderable
        row-drag
        renamable
        .nodes=${this.#tree.nodes}
        .selected=${this.#tree.selected}
        .expanded=${this.#tree.expanded}
        @jolly-select=${this.#tree.handleSelect}
        @jolly-toggle-expand=${this.#tree.handleToggleExpand}
        @jolly-toggle-visible=${this.#tree.handleToggleVisible}
        @jolly-rename=${this.#tree.handleRename}
        @jolly-reparent=${this.#tree.handleReparent}
        @jolly-context-request=${this.#menu.onContextRequest}
      ></jolly-tree>
      <jolly-context-menu
        label="Hierarchy actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #treeElement(): Tree | null {
    return this.renderRoot.querySelector("jolly-tree");
  }

  #contextMenu(): ContextMenu {
    const menu = this.renderRoot.querySelector("jolly-context-menu");
    if (menu === null) {
      throw new Error("HierarchyPanel: the context menu is not rendered.");
    }

    return menu;
  }
}

customElements.define("jolly-scene-hierarchy", HierarchyPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-hierarchy": HierarchyPanel;
  }
}

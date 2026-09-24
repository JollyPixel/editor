// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import {
  TreeSnapshot,
  isExpandable,
  resolveRename,
  type FlatTreeRow
} from "./model.ts";
import {
  idleTreeInteraction,
  resolveTreeKey,
  type TreeInteraction
} from "./interaction.ts";
import { treeStyles } from "./Tree.styles.ts";
import { TreeDragController } from "./TreeDragController.ts";
import { TreeSelectionController } from "./TreeSelectionController.ts";
import {
  emitDataEvent,
  type TreeDropAccept,
  type TreeNode
} from "./contract.ts";

// Registers the chevron, eye, lock and drag glyphs.
import "../../icon/Icon.ts";
import { originatesInButton } from "../../dom.ts";

@customElement("jolly-tree")
export class Tree<TData = unknown> extends LitElement {
  static override styles = treeStyles;

  @property({ attribute: false })
  declare nodes: TreeNode<TData>[];

  @property({ attribute: false })
  declare selected: string[];

  @property({ attribute: false })
  declare expanded: string[];

  @property({ type: Boolean, reflect: true })
  declare multiple: boolean;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "row-drag"
  })
  declare rowDrag: boolean;

  @property({ type: Boolean, reflect: true })
  declare renamable: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "activate-on-double-click"
  })
  declare activateOnDoubleClick: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "indent-guides"
  })
  declare indentGuides: boolean;

  @property({ attribute: false })
  declare acceptDrop: TreeDropAccept | null;

  @state()
  private declare _interaction: TreeInteraction;

  #snapshot: TreeSnapshot<TData>;
  #drag: TreeDragController<TData>;
  #selection: TreeSelectionController<TData>;

  constructor() {
    super();

    this.nodes = [];
    this.selected = [];
    this.expanded = [];
    this.multiple = false;
    this.reorderable = false;
    this.rowDrag = false;
    this.renamable = false;
    this.activateOnDoubleClick = false;
    this.indentGuides = false;
    this.acceptDrop = null;
    this._interaction = idleTreeInteraction();
    this.#snapshot = new TreeSnapshot(this.nodes);
    this.#drag = new TreeDragController(this, {
      nodes: () => this.nodes,
      snapshot: () => this.#snapshot,
      visibleRows: () => this.#visibleRows(),
      selected: () => this.selected,
      reorderable: () => this.reorderable,
      rowDrag: () => this.rowDrag,
      acceptDrop: () => this.acceptDrop,
      interaction: () => this._interaction,
      setInteraction: (next) => {
        this._interaction = next;
      },
      rowsRect: () => this.renderRoot.querySelector(".rows")?.getBoundingClientRect(),
      elementAtPoint: (clientX, clientY) => this.shadowRoot?.elementFromPoint(clientX, clientY) ?? null,
      indentUnit: () => parseFloat(
        getComputedStyle(this).getPropertyValue("--jolly-tree-indent")
      )
    });
    this.#selection = new TreeSelectionController(this, {
      visibleRows: () => this.#visibleRows(),
      selected: () => this.selected,
      multiple: () => this.multiple,
      interaction: () => this._interaction,
      setInteraction: (next) => {
        this._interaction = next;
      }
    });
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("nodes") || changed.has("expanded")) {
      this.#snapshot = new TreeSnapshot(
        this.nodes,
        new Set(this.expanded)
      );
    }
  }

  override render(): TemplateResult {
    const rows = this.#visibleRows();
    const activeId = this.#activeId(rows);

    return html`
      <div
        class="rows"
        role="tree"
        aria-multiselectable=${this.multiple ? "true" : "false"}
        @keydown=${this.#onKeyDown}
        @click=${(event: MouseEvent) => this.#selection.onRowsClick(event)}
      >${rows.map((row) => this.#renderRow(row, row.node.id === activeId))}</div>
    `;
  }

  #renderRow(
    row: FlatTreeRow<TData>,
    active: boolean
  ): TemplateResult {
    const { node, depth } = row;
    const isBranch = isExpandable(node);
    const isExpanded = this.expanded.includes(node.id);
    const isSelected = this.selected.includes(node.id);
    const isDragSource = this.#drag.isDragSource(node.id);
    const isMoveCursor = this.#drag.isMoveCursor(node.id);
    const expandedState = isBranch ? String(isExpanded) : nothing;
    const isHidden = node.visible === false;
    const rowIndent = `calc(${depth} * var(--jolly-tree-indent, 16px))`;
    const { drop, dropIndent } = this.#drag.dropStyleFor(node.id, rowIndent);
    const rowStyle = `--jolly-tree-row-indent: ${rowIndent}; ` +
      `--jolly-tree-drop-indent: ${dropIndent}; ` +
      "padding-inline-start: var(--jolly-tree-row-indent)";

    return html`
      <div
        class="row"
        role="treeitem"
        data-id=${node.id}
        tabindex=${active ? "0" : "-1"}
        aria-selected=${isSelected ? "true" : "false"}
        aria-expanded=${expandedState}
        data-dragging=${isDragSource ? "true" : nothing}
        data-drop=${drop ?? nothing}
        data-move-cursor=${isMoveCursor ? "true" : nothing}
        data-hidden=${isHidden ? "true" : nothing}
        style=${rowStyle}
        @click=${(event: MouseEvent) => this.#selection.onRowClick(event, node.id)}
        @dblclick=${(event: MouseEvent) => this.#onRowDoubleClick(event, node.id)}
        @pointerdown=${(event: PointerEvent) => this.#drag.onRowPointerDown(event, node.id)}
      >
        ${isBranch ? html`
          <button
            class="toggle"
            type="button"
            tabindex="-1"
            aria-label=${isExpanded ? "Collapse" : "Expand"}
            @click=${(event: Event) => this.#onToggleExpand(event, node.id)}
          ><jolly-icon name="chevron" aria-hidden="true"></jolly-icon></button>
        ` : nothing}
        <span class="content">
          ${!isBranch && this.#snapshot.hasBranches ? html`
            <span class="toggle-spacer"></span>
          ` : nothing}
          ${node.icon === undefined ? nothing : html`
            <jolly-icon class="node-icon" name=${node.icon} aria-hidden="true"></jolly-icon>
          `}
          ${this.#renderLabel(node)}
          ${node.detail ? html`<span class="detail">${node.detail}</span>` : nothing}
          ${this.#renderBadges(node)}
          ${node.visible === undefined ? nothing : html`
            <button
              class="visible-toggle"
              type="button"
              tabindex="-1"
              data-active=${node.visible ? "true" : "false"}
              aria-label=${node.visible ? "Hide" : "Show"}
              aria-pressed=${node.visible ? "true" : "false"}
              @click=${(event: Event) => this.#onToggleVisible(event, node.id)}
            ><jolly-icon name="eye" aria-hidden="true"></jolly-icon></button>
          `}
          ${node.locked === undefined ? nothing : html`
            <button
              class="lock-toggle"
              type="button"
              tabindex="-1"
              data-active=${node.locked ? "true" : "false"}
              aria-label=${node.locked ? "Unlock" : "Lock"}
              aria-pressed=${node.locked ? "true" : "false"}
              @click=${(event: Event) => this.#onToggleLock(event, node.id)}
            ><jolly-icon name="lock" aria-hidden="true"></jolly-icon></button>
          `}
          ${this.reorderable ? html`
            <button
              class="grip"
              type="button"
              tabindex="-1"
              aria-hidden="true"
              @pointerdown=${(event: PointerEvent) => this.#drag.onGripPointerDown(event, node.id)}
            ><jolly-icon name="drag" aria-hidden="true"></jolly-icon></button>
          ` : nothing}
        </span>
      </div>
    `;
  }

  #visibleRows(): readonly FlatTreeRow<TData>[] {
    return this.#snapshot.visibleRows;
  }

  #activeId(
    rows: readonly FlatTreeRow<TData>[]
  ): string | null {
    if (rows.length === 0) {
      return null;
    }

    const selectedAnchor = this.selected[0];
    if (selectedAnchor !== undefined && rows.some((row) => row.node.id === selectedAnchor)) {
      return selectedAnchor;
    }

    return rows[0].node.id;
  }

  protected override updated(
    changed: Map<string, unknown>
  ): void {
    if (
      changed.has("_interaction") &&
      this._interaction.kind === "renaming"
    ) {
      this.renderRoot.querySelector<HTMLInputElement>(".rename")?.focus();
    }
  }

  #renderBadges(
    node: TreeNode<TData>
  ): TemplateResult | typeof nothing {
    const badges = node.badges;
    if (badges === undefined || badges.length === 0) {
      return nothing;
    }

    return html`
      <span class="badges">${badges.map((badge) => html`
        <span
          class="badge"
          role="img"
          aria-label=${badge.title ?? "Badge"}
          title=${badge.title ?? nothing}
          style="background: ${badge.color}"
        ></span>
      `)}</span>
    `;
  }

  #renderLabel(
    node: TreeNode<TData>
  ): TemplateResult {
    if (
      this._interaction.kind !== "renaming" ||
      this._interaction.id !== node.id
    ) {
      return html`<span class="label">${node.label}</span>`;
    }

    return html`
      <input
        class="label rename"
        type="text"
        .value=${node.label}
        aria-label="Rename"
        @keydown=${this.#onRenameKeyDown}
        @blur=${(event: FocusEvent) => this.#commitRename(event.target, node)}
        @focus=${this.#onRenameFocus}
      >
    `;
  }

  beginRename(
    id: string
  ): boolean {
    if (!this.#isRenamable(id) || this._interaction.kind !== "idle") {
      return false;
    }

    this.#startRename(id);

    return true;
  }

  #isRenamable(
    id: string
  ): boolean {
    return this.renamable &&
      this.#snapshot.node(id)?.renamable === true;
  }

  #startRename(
    id: string
  ): void {
    if (this.#isRenamable(id)) {
      this._interaction = {
        kind: "renaming",
        id
      };
    }
  }

  readonly #onRenameFocus = (
    event: FocusEvent
  ): void => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      input.select();
    }
  };

  readonly #onRenameKeyDown = (
    event: KeyboardEvent
  ): void => {
    // The tree's own navigation must not read the keys typed into the field.
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      this.#cancelRename();
    }
    else if (event.key === "Enter") {
      event.preventDefault();
      // Blur commits, so the two paths cannot double-emit.
      (event.target as HTMLInputElement).blur();
    }
  };

  #cancelRename(): void {
    const id = this._interaction.kind === "renaming" ?
      this._interaction.id :
      null;
    this._interaction = idleTreeInteraction();
    if (id !== null) {
      this.#focusRow(id);
    }
  }

  #commitRename(
    target: EventTarget | null,
    node: TreeNode<TData>
  ): void {
    if (
      this._interaction.kind !== "renaming" ||
      this._interaction.id !== node.id
    ) {
      return;
    }

    this._interaction = idleTreeInteraction();
    const name = resolveRename(
      node.label,
      target instanceof HTMLInputElement ? target.value : ""
    );
    if (name !== null) {
      emitDataEvent(this, "jolly-rename", { id: node.id, name });
    }
    this.#focusRow(node.id);
  }

  #focusRow(
    id: string
  ): void {
    this.updateComplete.then(() => {
      const row = this.renderRoot.querySelector<HTMLElement>(
        `.row[data-id="${CSS.escape(id)}"]`
      );
      row?.focus();
    });
  }

  #onRowDoubleClick(
    event: MouseEvent,
    id: string
  ): void {
    if (originatesInButton(event.target)) {
      return;
    }

    if (!this.activateOnDoubleClick && this.#isRenamable(id)) {
      event.preventDefault();
      this.#startRename(id);

      return;
    }

    emitDataEvent(this, "jolly-activate", { id });
  }

  #onToggleExpand(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    emitDataEvent(this, "jolly-toggle-expand", {
      id,
      expanded: !this.expanded.includes(id)
    });
  }

  #onToggleVisible(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    const node = this.#snapshot.node(id);
    if (node === null || node.visible === undefined) {
      return;
    }

    emitDataEvent(this, "jolly-toggle-visible", { id, visible: !node.visible });
  }

  #onToggleLock(
    event: Event,
    id: string
  ): void {
    event.stopPropagation();
    const node = this.#snapshot.node(id);
    if (node === null || node.locked === undefined) {
      return;
    }

    emitDataEvent(this, "jolly-toggle-lock", { id, locked: !node.locked });
  }

  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const rows = this.#visibleRows();
    if (rows.length === 0) {
      return;
    }
    const activeId = this.#activeId(rows);
    if (activeId === null) {
      return;
    }
    const renamableIds = new Set(
      rows
        .filter((row) => this.#isRenamable(row.node.id))
        .map((row) => row.node.id)
    );
    const action = resolveTreeKey({
      key: event.key,
      rows,
      activeId,
      interaction: this._interaction,
      selected: this.selected,
      expanded: new Set(this.expanded),
      reorderable: this.reorderable,
      renamableIds
    });
    if (action === null) {
      return;
    }

    event.preventDefault();
    switch (action.kind) {
      case "select":
        this.#selection.selectSingle(action.id);
        break;
      case "toggle-expand":
        emitDataEvent(this, "jolly-toggle-expand", action);
        break;
      case "activate":
        emitDataEvent(this, "jolly-activate", { id: action.id });
        break;
      case "rename":
        this.#startRename(action.id);
        break;
      case "interaction":
        this._interaction = action.interaction;
        break;
      case "commit-move":
        this.#drag.commitKeyboardMove();
        break;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tree": Tree;
  }
}

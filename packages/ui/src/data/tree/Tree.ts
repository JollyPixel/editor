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
import { guard } from "lit/directives/guard.js";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { flow } from "@lit-labs/virtualizer/layouts/flow.js";
import { virtualize } from "@lit-labs/virtualizer/virtualize.js";

// Import Internal Dependencies
import {
  TreeSnapshot,
  idListChanged,
  type FlatTreeRow
} from "./model.ts";
import {
  TreeRowView,
  TreeRowViewList,
  type TreeRowState
} from "./TreeRowView.ts";
import {
  idleTreeInteraction,
  resolveTreeKey,
  type TreeInteraction
} from "./interaction.ts";
import { treeStyles } from "./Tree.styles.ts";
import {
  TreeRowLayout,
  type TreeRail
} from "./TreeRowLayout.ts";
import {
  BOX_GLYPH,
  renderBadges,
  renderGuides,
  renderIcon,
  renderLabelText,
  renderSwatch,
  renderWarning
} from "./rowTemplates.ts";
import { TreeDragController } from "./TreeDragController.ts";
import { TreeFlash } from "./TreeFlash.ts";
import { TreeFocusController } from "./TreeFocusController.ts";
import { TreeHairlineController } from "./TreeHairlineController.ts";
import { TreeRenameController } from "./TreeRenameController.ts";
import { TreeSelectionController } from "./TreeSelectionController.ts";
import {
  emitDataEvent,
  type TreeDragOut,
  type TreeDropAccept,
  type TreeIndentGuidesScope,
  type TreeNode,
  type TreeRenameValidator,
  type TreeSwatchPosition,
  type TreeToggleStyle
} from "./contract.ts";

import "../../icon/Icon.ts";
import "../../peer/Avatar.ts";
import {
  originatesInButton,
  stopPropagation
} from "../../dom.ts";
import { revealOverflowTitle } from "../../interaction/overflowTitle.ts";
import { SearchQuery } from "../../search/SearchQuery.ts";
import type { Searchable } from "../../search/Searchable.ts";
import { TreeFilter } from "./TreeFilter.ts";

// CONSTANTS
const kFlowLayout = flow();
const kNoRails: readonly TreeRail[] = Object.freeze([]);

@customElement("jolly-tree")
export class Tree<TData = unknown> extends LitElement
  implements Searchable {
  static override styles = treeStyles;

  @property({ attribute: false })
  declare nodes: TreeNode<TData>[];

  @property({
    attribute: false,
    hasChanged: idListChanged
  })
  declare selected: string[];

  @property({
    attribute: false,
    hasChanged: idListChanged
  })
  declare expanded: string[];

  @property({ type: Boolean, reflect: true })
  declare multiple: boolean;

  @property({
    type: Boolean,
    reflect: true,
    attribute: "require-selection"
  })
  declare requireSelection: boolean;

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

  @property({
    reflect: true,
    attribute: "indent-guides-scope"
  })
  declare indentGuidesScope: TreeIndentGuidesScope;

  @property({
    reflect: true,
    attribute: "toggle-style"
  })
  declare toggleStyle: TreeToggleStyle;

  @property({
    reflect: true,
    attribute: "swatch-position"
  })
  declare swatchPosition: TreeSwatchPosition;

  @property({ attribute: false })
  declare acceptDrop: TreeDropAccept | null;

  @property({ attribute: false })
  declare dragOut: TreeDragOut | null;

  @property({ type: Boolean, reflect: true })
  declare virtual: boolean;

  @property({ attribute: false })
  declare validateRename: TreeRenameValidator | null;

  @property({ type: String })
  declare filter: string;

  @state()
  private declare _interaction: TreeInteraction;

  #snapshot: TreeSnapshot<TData>;
  #layout: TreeRowLayout<TData>;
  #expandedIds: ReadonlySet<string>;
  #selectedIds: ReadonlySet<string>;
  #drag: TreeDragController<TData>;
  #selection: TreeSelectionController<TData>;
  #rowViewList = new TreeRowViewList();
  #rowState: TreeRowState = {
    position: 1,
    setSize: 1,
    expanded: false,
    selected: false,
    active: false,
    drop: null,
    dropIndent: "",
    dragSource: false,
    moveCursor: false,
    renaming: false,
    renameError: null,
    spacer: "none",
    rails: kNoRails,
    swatchPosition: "end",
    reorderable: false,
    match: null,
    flash: false
  };
  #filtered = new TreeFilter<TData>([], SearchQuery.EMPTY);
  #activeRowId: string | null = null;
  #focus: TreeFocusController;
  #flash = new TreeFlash(this);
  #rename: TreeRenameController;
  readonly #switchInteraction = (
    next: TreeInteraction
  ): void => {
    this._interaction = next;
  };

  constructor() {
    super();

    this.nodes = [];
    this.selected = [];
    this.expanded = [];
    this.multiple = false;
    this.requireSelection = false;
    this.reorderable = false;
    this.rowDrag = false;
    this.renamable = false;
    this.activateOnDoubleClick = false;
    this.indentGuides = false;
    this.indentGuidesScope = "all";
    this.toggleStyle = "chevron";
    this.swatchPosition = "end";
    this.acceptDrop = null;
    this.dragOut = null;
    this.virtual = false;
    this.validateRename = null;
    this.filter = "";
    this._interaction = idleTreeInteraction();
    new TreeHairlineController(this);
    this.#expandedIds = new Set();
    this.#selectedIds = new Set();
    this.#snapshot = new TreeSnapshot(this.nodes);
    this.#layout = new TreeRowLayout(this.#snapshot, this.#expandedIds);
    this.#drag = new TreeDragController(this, {
      snapshot: () => this.#snapshot,
      visibleRows: () => this.#visibleRows(),
      selected: () => this.selected,
      reorderable: () => this.#reorderable,
      rowDrag: () => this.rowDrag && this.#filtered.query.isEmpty,
      acceptDrop: () => this.acceptDrop,
      dragOut: () => this.dragOut,
      interaction: () => this._interaction,
      switchInteraction: this.#switchInteraction,
      rowsRect: () => this.renderRoot.querySelector(".rows")?.getBoundingClientRect(),
      elementAtPoint: (clientX, clientY) => this.shadowRoot?.elementFromPoint(clientX, clientY) ?? null,
      indentUnit: () => parseFloat(
        getComputedStyle(this).getPropertyValue("--jolly-tree-indent")
      )
    });
    this.#focus = new TreeFocusController(this, {
      virtual: () => this.virtual,
      rowsElement: () => this.renderRoot.querySelector<HTMLElement>(".rows"),
      rowElement: (id) => this.#rowElement(id),
      rowIndex: (id) => this.#rowViewList.indexOf(id),
      activeId: () => this.#activeRowId,
      renaming: () => this._interaction.kind === "renaming"
    });
    this.#rename = new TreeRenameController(this, {
      validateRename: () => this.validateRename,
      interaction: () => this._interaction,
      switchInteraction: this.#switchInteraction,
      focusRow: (id) => this.#focus.focusRow(id)
    });
    this.#selection = new TreeSelectionController(this, {
      visibleRows: () => this.#visibleRows(),
      selected: () => this.selected,
      multiple: () => this.multiple,
      requireSelection: () => this.requireSelection,
      interaction: () => this._interaction,
      switchInteraction: this.#switchInteraction
    });
  }

  protected override willUpdate(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("expanded")) {
      this.#expandedIds = new Set(this.expanded);
    }
    if (changed.has("selected")) {
      this.#selectedIds = new Set(this.selected);
    }
    const query = changed.has("filter") ?
      new SearchQuery(this.filter) :
      this.#filtered.query;
    if (
      changed.has("nodes") ||
      changed.has("expanded") ||
      !query.equals(this.#filtered.query)
    ) {
      this.#rebuild(query);
    }
    else if (changed.has("selected")) {
      this.#layout.follow(this.#selectedIds);
    }
  }

  reveal(
    id: string
  ): void {
    this.#flash.flash(id);
    this.#focus.reveal(id);
  }

  applySearch(
    query: SearchQuery
  ): number {
    this.filter = query.text;
    if (!query.equals(this.#filtered.query)) {
      this.#rebuild(query);
    }

    return this.#filtered.matches.size;
  }

  get #reorderable(): boolean {
    return this.reorderable && this.#filtered.query.isEmpty;
  }

  #rebuild(
    query: SearchQuery
  ): void {
    this.#filtered = new TreeFilter(this.nodes, query);
    this.#snapshot = new TreeSnapshot(this.#filtered.nodes, this.#expandedIds);
    this.#layout = new TreeRowLayout(this.#snapshot, this.#expandedIds);
    this.#layout.follow(this.#selectedIds);
  }

  override render(): TemplateResult {
    const views = this.#rowViews();

    return html`${keyed(this.virtual, html`
      <div
        class="rows"
        role="tree"
        aria-multiselectable=${this.multiple ? "true" : "false"}
        @keydown=${this.#onKeyDown}
        @click=${(event: MouseEvent) => this.#selection.onRowsClick(event)}
        @contextmenu=${this.#onRowsContextMenu}
        @focus=${this.#focus.onRowsFocus}
        @rangeChanged=${this.#focus.onRangeChanged}
      >${this.#renderRows(views)}</div>
    `)}`;
  }

  #renderRows(
    views: TreeRowView[]
  ): unknown {
    return this.virtual ?
      virtualize({
        items: views,
        keyFunction: (view) => view.id,
        renderItem: (view) => html`${this.#guardedRow(view)}`,
        layout: kFlowLayout,
        scroller: true
      }) :
      repeat(
        views,
        (view) => view.id,
        (view) => this.#guardedRow(view)
      );
  }

  #guardedRow(
    view: TreeRowView
  ): unknown {
    return guard([view], () => this.#renderRow(view));
  }

  #rowViews(): TreeRowView[] {
    const rows = this.#visibleRows();
    const activeId = this.#activeId(rows);
    const renaming = this._interaction.kind === "renaming" ?
      this._interaction :
      null;
    this.#activeRowId = activeId;

    const state = this.#rowState;
    const layout = this.#layout;
    const guides = this.indentGuides;
    const scope = this.indentGuidesScope;
    const { matches } = this.#filtered;
    state.swatchPosition = this.swatchPosition;
    state.reorderable = this.#reorderable;

    return this.#rowViewList.update(rows, (row) => {
      const { id } = row.node;
      const placement = this.#snapshot.placement(id);
      const { drop, dropIndent } = this.#drag.rowDropStyle(
        id,
        TreeRowView.indentStyle(row.depth)
      );
      state.position = placement?.position ?? 1;
      state.setSize = placement?.size ?? 1;
      state.spacer = layout.spacer(id, guides);
      state.rails = guides ? layout.rails(id, scope) : kNoRails;
      state.expanded = this.#expandedIds.has(id);
      state.match = matches.get(id) ?? null;
      state.selected = this.#selectedIds.has(id);
      state.active = id === activeId;
      state.drop = drop;
      state.dropIndent = dropIndent;
      state.dragSource = this.#drag.isDragSource(id);
      state.moveCursor = this.#drag.isMoveCursor(id);
      state.renaming = id === renaming?.id;
      state.renameError = id === renaming?.id ? renaming.error : null;
      state.flash = this.#flash.flashing(id);

      return state;
    });
  }

  #renderRow(
    view: TreeRowView
  ): TemplateResult {
    const { id } = view;
    const rowStyle = {
      "--jolly-tree-row-indent": view.indent,
      "--jolly-tree-drop-indent": view.dropIndent,
      "padding-inline-start": "var(--jolly-tree-row-indent)"
    };

    return html`
      <div
        class="row"
        role="treeitem"
        data-id=${id}
        tabindex=${view.active ? "0" : "-1"}
        aria-level=${view.depth + 1}
        aria-posinset=${view.position}
        aria-setsize=${view.setSize}
        aria-selected=${view.selected ? "true" : "false"}
        aria-expanded=${view.branch ? String(view.expanded) : nothing}
        data-dragging=${view.dragSource ? "true" : nothing}
        data-drop=${view.drop ?? nothing}
        data-move-cursor=${view.moveCursor ? "true" : nothing}
        data-hidden=${view.visible === false ? "true" : nothing}
        data-warning=${view.warning === undefined ? nothing : "true"}
        data-spacer=${view.spacer === "outside" ? "outside" : nothing}
        data-flash=${view.flash ? "true" : nothing}
        style=${styleMap(rowStyle)}
        @click=${(event: MouseEvent) => this.#selection.onRowClick(event, id)}
        @dblclick=${(event: MouseEvent) => this.#onRowDoubleClick(event, id)}
        @contextmenu=${(event: MouseEvent) => this.#onRowContextMenu(event, id)}
        @pointerdown=${(event: PointerEvent) => this.#drag.onRowPointerDown(event, id)}
        @animationend=${(event: AnimationEvent) => this.#flash.end(event, id)}
      >
        ${renderGuides(view.rails)}
        ${view.branch ? html`
          <button
            class="toggle"
            type="button"
            tabindex="-1"
            aria-label=${view.expanded ? "Collapse" : "Expand"}
            @click=${(event: Event) => this.#onToggleExpand(event, id)}
          ><jolly-icon name="chevron" aria-hidden="true"></jolly-icon>${BOX_GLYPH}</button>
        ` : nothing}
        ${view.spacer === "outside" ? html`
          <span class="toggle-spacer"></span>
        ` : nothing}
        <span class="content" part=${view.contentPart}>
          ${view.spacer === "inside" ? html`
            <span class="toggle-spacer"></span>
          ` : nothing}
          ${renderIcon(view)}
          ${view.swatchPosition === "start" ? renderSwatch(view, this.#onActivateSwatch) : nothing}
          ${this.#renderLabel(view)}
          ${view.detail ? html`<span class="detail">${view.detail}</span>` : nothing}
          ${view.swatchPosition === "end" ? renderSwatch(view, this.#onActivateSwatch) : nothing}
          ${renderWarning(view)}
          ${renderBadges(view)}
          ${view.visible === undefined ? nothing : html`
            <button
              class="visible-toggle"
              type="button"
              tabindex="-1"
              data-active=${view.visible ? "true" : "false"}
              aria-label=${view.visible ? "Hide" : "Show"}
              aria-pressed=${view.visible ? "true" : "false"}
              @click=${(event: Event) => this.#onToggleVisible(event, id)}
            ><jolly-icon name="eye" aria-hidden="true"></jolly-icon></button>
          `}
          ${view.locked === undefined ? nothing : html`
            <button
              class="lock-toggle"
              type="button"
              tabindex="-1"
              data-active=${view.locked ? "true" : "false"}
              aria-label=${view.locked ? "Unlock" : "Lock"}
              aria-pressed=${view.locked ? "true" : "false"}
              @click=${(event: Event) => this.#onToggleLock(event, id)}
            ><jolly-icon name="lock" aria-hidden="true"></jolly-icon></button>
          `}
          ${view.reorderable ? html`
            <button
              class="grip"
              part="grip"
              type="button"
              tabindex="-1"
              aria-hidden="true"
              @pointerdown=${(event: PointerEvent) => this.#drag.onGripPointerDown(event, id)}
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
      this.#focus.focusRenameField();
    }
  }

  #rowElement(
    id: string
  ): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(
      `.row[data-id="${CSS.escape(id)}"]`
    );
  }

  readonly #onActivateSwatch = (
    event: Event,
    id: string
  ): void => {
    event.stopPropagation();
    emitDataEvent(this, "jolly-activate-swatch", { id });
  };

  #renderLabel(
    view: TreeRowView
  ): TemplateResult {
    if (!view.renaming) {
      return html`<span
        class="label"
        @pointerenter=${revealOverflowTitle}
      >${renderLabelText(view)}</span>`;
    }

    const message = view.renameError;

    return html`
      <input
        class="label rename"
        type="text"
        .value=${view.label}
        aria-label="Rename"
        aria-invalid=${message === null ? nothing : "true"}
        aria-errormessage=${message === null ? nothing : "rename-error"}
        @pointerdown=${stopPropagation}
        @click=${stopPropagation}
        @dblclick=${stopPropagation}
        @keydown=${(event: KeyboardEvent) => this.#rename.onKeyDown(event, view)}
        @input=${(event: InputEvent) => this.#rename.onInput(event, view)}
        @blur=${(event: FocusEvent) => this.#rename.onBlur(event, view)}
        @focus=${this.#rename.onFocus}
      >
      ${message === null ? nothing : html`
        <span id="rename-error" class="rename-error" role="alert">${message}</span>
      `}
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
        id,
        error: null
      };
      this.#focus.reveal(id);
    }
  }

  #onRowContextMenu(
    event: MouseEvent,
    id: string
  ): void {
    const row = event.currentTarget;
    if (this._interaction.kind !== "idle" || !(row instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    if (!this.selected.includes(id)) {
      this.#selection.selectSingle(id);
    }
    row.focus();

    const fromPointer = event.button === 2;
    const rect = row.getBoundingClientRect();
    emitDataEvent(this, "jolly-context-request", {
      id,
      x: fromPointer ? event.clientX : rect.left,
      y: fromPointer ? event.clientY : rect.bottom
    });
  }

  readonly #onRowsContextMenu = (
    event: MouseEvent
  ): void => {
    if (event.target !== event.currentTarget || this._interaction.kind !== "idle") {
      return;
    }

    event.preventDefault();
    emitDataEvent(this, "jolly-context-request", {
      id: null,
      x: event.clientX,
      y: event.clientY
    });
  };

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
    const action = resolveTreeKey({
      key: event.key,
      rows,
      activeId,
      interaction: this._interaction,
      selected: this.selected,
      expanded: this.#expandedIds,
      reorderable: this.#reorderable,
      renamableIds: this.#isRenamable(activeId) ? new Set([activeId]) : new Set()
    });
    if (action === null) {
      return;
    }

    event.preventDefault();
    switch (action.kind) {
      case "select":
        this.#selection.selectSingle(action.id);
        this.#focus.focusRow(action.id);
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
        if (action.interaction.kind === "keyboard-move") {
          this.#focus.reveal(action.interaction.cursorId);
        }
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

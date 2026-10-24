// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type {
  Dialog,
  JollyRenameDetail,
  JollySelectDetail,
  Tree,
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/toggle";
import "@jolly-pixel/ui/elements/tree";
import {
  DEFAULT_UV_SLOTS,
  type UVRegion,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { UvNetLibrary } from "./UvNetLibrary.ts";
import type { UvNetPreset } from "./UvNetPreset.ts";
import {
  UvNetDraft,
  type UvNetCellPosition
} from "./UvNetDraft.ts";
import { UvNetPreview } from "./UvNetPreview.ts";
import { uvNetDialogStyles } from "./UvNetDialog.styles.ts";

// CONSTANTS
const kEmptyNetMessage = "A net needs at least one slot";
const kBuiltInBadge: TreeBadge = {
  color: "currentColor",
  icon: "lock",
  title: "Built-in"
};
const kArrowMoves: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};

export interface UvNetDialogContext {
  library: UvNetLibrary;
  region: UVRegion | null;
  apply: (preset: UvNetPreset) => void;
}

@customElement("uv-net-dialog")
export class UvNetDialog extends LitElement {
  static override styles = uvNetDialogStyles;

  @query("jolly-dialog")
  declare private dialogElement: Dialog;

  @query("jolly-tree")
  declare private treeElement: Tree;

  @state()
  declare private selectedId: string;

  @state()
  declare private status: string;

  @state()
  declare private dropTarget: string | null;

  #context: UvNetDialogContext | null = null;
  #release: (() => void) | null = null;

  constructor() {
    super();
    this.selectedId = "";
    this.status = "";
    this.dropTarget = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe();
  }

  async open(
    context: UvNetDialogContext
  ): Promise<void> {
    this.#unsubscribe();
    this.#context = context;
    this.#release = context.library.subscribe("change", () => this.requestUpdate());
    this.selectedId = context.library.defaultId;
    this.status = "";

    await this.updateComplete;
    await this.dialogElement.showModal();
  }

  override render(): TemplateResult {
    const context = this.#context;
    const preset = context?.library.get(this.selectedId);

    return html`
      <jolly-dialog
        heading="UV nets"
        icon="unfold"
        @jolly-close=${this.#unsubscribe}
      >
        ${context && preset ? this.#renderBody(context, preset) : nothing}
        ${context?.region && preset ? html`
          <jolly-button
            slot="actions"
            part="uv-net-apply"
            ?disabled=${!preset.fits(context.region.activeSlots)}
            @click=${() => context.apply(preset)}
          >Apply to region</jolly-button>
        ` : nothing}
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${() => this.dialogElement.close("close")}
        >Close</jolly-button>
      </jolly-dialog>
    `;
  }

  #renderBody(
    context: UvNetDialogContext,
    preset: UvNetPreset
  ): TemplateResult {
    const { library, region } = context;
    const preview = new UvNetPreview(preset.net, region);
    const missing = region === null ? [] : preset.net.missingSlots(region.activeSlots);

    return html`
      <div class="layout">
        <div class="nets">
          <div class="nets-header">
            <span class="nets-title">Nets</span>
            <jolly-button
              part="uv-net-new"
              icon="plus"
              icon-only
              label="New net"
              title="New net"
              @click=${() => this.#rename(library.create("New net").id)}
            ></jolly-button>
            <jolly-button
              part="uv-net-duplicate"
              icon="copy"
              icon-only
              label="Duplicate net"
              title="Duplicate net"
              @click=${() => this.#rename(library.duplicate(preset.id)?.id)}
            ></jolly-button>
            <jolly-button
              part="uv-net-delete"
              icon="trash"
              icon-only
              variant="danger"
              label="Delete net"
              title="Delete net"
              ?disabled=${preset.locked}
              @click=${() => this.#delete(library, preset)}
            ></jolly-button>
          </div>
          <jolly-tree
            part="uv-net-list"
            aria-label="Nets"
            require-selection
            renamable
            .nodes=${[...library].map((item) => this.#node(library, item))}
            .selected=${[preset.id]}
            @jolly-select=${(event: CustomEvent<JollySelectDetail>) => {
              this.#select(event.detail.selected[0]);
            }}
            @jolly-rename=${(event: CustomEvent<JollyRenameDetail>) => {
              library.update(event.detail.id, { name: event.detail.name });
            }}
          ></jolly-tree>
        </div>
        <div class="editor">
          <jolly-toggle
            label="Default net"
            part="uv-net-default"
            .value=${library.defaultId === preset.id}
            ?readonly=${library.defaultId === preset.id}
            @jolly-change=${() => {
              library.defaultId = preset.id;
            }}
          ></jolly-toggle>
          ${preset.rows === null ?
            html`<p class="caption">Packs the slots into the smallest box.</p>` :
            this.#renderGrid(library, preset, UvNetDraft.from(preset.rows))}
          ${this.status === "" ?
            nothing :
            html`<p class="caption status" role="status">${this.status}</p>`}
          <p class="caption">
            ${region === null ? "Preview of a box" : "Preview of the selected region"}
            ${missing.length === 0 ? nothing : html` · missing ${missing.join(", ")}`}
          </p>
          ${preview.render()}
        </div>
      </div>
    `;
  }

  #node(
    library: UvNetLibrary,
    preset: UvNetPreset
  ): TreeNode {
    return {
      id: preset.id,
      label: preset.name,
      renamable: !preset.locked,
      detail: library.defaultId === preset.id ? "default" : undefined,
      badges: preset.locked ? [kBuiltInBadge] : undefined
    };
  }

  #renderGrid(
    library: UvNetLibrary,
    preset: UvNetPreset,
    draft: UvNetDraft
  ): TemplateResult {
    const editable = !preset.locked;
    const edge = editable ? 1 : 0;
    const rows = Array.from({ length: draft.rowCount + edge * 2 }, (_, index) => index - edge);
    const columns = Array.from({ length: draft.columnCount + edge * 2 }, (_, index) => index - edge);
    const commit = (next: UvNetDraft, focus: UVSlot | null = null) => {
      this.#commit(library, preset, next, focus);
    };
    const vocabulary = new Set([
      ...DEFAULT_UV_SLOTS,
      ...(this.#context?.region?.activeSlots ?? []),
      ...draft.slots
    ]);
    const unplaced = [...vocabulary].filter((slot) => draft.find(slot) === null);

    return html`
      <div
        class="grid"
        part="uv-net-grid"
        style="grid-template-columns: repeat(${columns.length}, auto)"
      >
        ${rows.map((row) => columns.map((column) => this.#renderCell(
          draft,
          { row, column },
          editable,
          commit
        )))}
      </div>
      ${editable ? html`
        <p class="caption">
          Drop slots on a cell to share its pixels. Arrow keys move a focused slot, Delete removes it.
        </p>
        <div
          class=${classMap({ tray: true, "drop-target": this.dropTarget === "tray" })}
          part="uv-net-tray"
          aria-label="Unplaced slots"
          @dragover=${(event: DragEvent) => this.#allowDrop(event, "tray")}
          @dragleave=${() => this.#clearDropTarget("tray")}
          @drop=${(event: DragEvent) => this.#drop(event, (slot) => commit(draft.unplaced(slot)))}
        >
          ${unplaced.length === 0 ?
            html`<span class="caption">Unplaced: none</span>` :
            unplaced.map((slot) => this.#renderChip(slot, true, (event) => {
              if (event.key === "Enter") {
                commit(draft.placed(slot, { row: 0, column: draft.columnCount }), slot);
              }
            }))}
        </div>
      ` : nothing}
    `;
  }

  #renderCell(
    draft: UvNetDraft,
    position: UvNetCellPosition,
    editable: boolean,
    commit: (next: UvNetDraft, focus?: UVSlot | null) => void
  ): TemplateResult {
    const key = `${position.row}:${position.column}`;
    const outside = position.row < 0 || position.column < 0 ||
      position.row >= draft.rowCount || position.column >= draft.columnCount;

    return html`
      <div
        class=${classMap({
          cell: true,
          edge: outside,
          "drop-target": this.dropTarget === key
        })}
        part="uv-net-cell"
        data-row=${position.row}
        data-column=${position.column}
        @dragover=${editable ? (event: DragEvent) => this.#allowDrop(event, key) : nothing}
        @dragleave=${() => this.#clearDropTarget(key)}
        @drop=${(event: DragEvent) => this.#drop(event, (slot) => commit(draft.placed(slot, position)))}
      >
        ${draft.cellAt(position).map((slot) => this.#renderChip(slot, editable, (event) => {
          const move = kArrowMoves[event.key];
          if (move !== undefined) {
            event.preventDefault();
            commit(draft.moved(slot, move[0], move[1]), slot);
          }
          else if (event.key === "Delete" || event.key === "Backspace") {
            commit(draft.unplaced(slot));
          }
        }))}
      </div>
    `;
  }

  #renderChip(
    slot: UVSlot,
    editable: boolean,
    onKeyDown: (event: KeyboardEvent) => void
  ): TemplateResult {
    return html`
      <span
        class="chip"
        part="uv-net-chip"
        data-slot=${slot}
        draggable=${editable ? "true" : "false"}
        tabindex=${editable ? "0" : nothing}
        @dragstart=${(event: DragEvent) => event.dataTransfer?.setData("text/plain", slot)}
        @keydown=${editable ? onKeyDown : nothing}
      >${slot}</span>
    `;
  }

  #allowDrop(
    event: DragEvent,
    target: string
  ): void {
    event.preventDefault();
    this.dropTarget = target;
  }

  #clearDropTarget(
    target: string
  ): void {
    if (this.dropTarget === target) {
      this.dropTarget = null;
    }
  }

  #drop(
    event: DragEvent,
    apply: (slot: UVSlot) => void
  ): void {
    event.preventDefault();
    this.dropTarget = null;
    const slot = event.dataTransfer?.getData("text/plain") ?? "";
    if (slot !== "") {
      apply(slot);
    }
  }

  #commit(
    library: UvNetLibrary,
    preset: UvNetPreset,
    next: UvNetDraft,
    focus: UVSlot | null
  ): void {
    const saved = library.update(preset.id, { rows: next.cells });
    this.status = saved ? "" : kEmptyNetMessage;
    if (saved && focus !== null) {
      void this.updateComplete.then(() => {
        this.renderRoot
          .querySelector<HTMLElement>(`.grid [data-slot="${CSS.escape(focus)}"]`)
          ?.focus();
      });
    }
  }

  #select(
    id: string | undefined
  ): void {
    if (id !== undefined) {
      this.selectedId = id;
      this.status = "";
    }
  }

  #rename(
    id: string | undefined
  ): void {
    if (id === undefined) {
      return;
    }

    this.#select(id);
    void this.updateComplete.then(() => this.treeElement.beginRename(id));
  }

  #delete(
    library: UvNetLibrary,
    preset: UvNetPreset
  ): void {
    if (library.delete(preset.id)) {
      this.#select(library.defaultId);
    }
  }

  #unsubscribe = (): void => {
    this.#release?.();
    this.#release = null;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "uv-net-dialog": UvNetDialog;
  }
}

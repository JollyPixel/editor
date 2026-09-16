// Import Third-party Dependencies
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { dockStyles } from "./Dock.styles.ts";
import type { DockColumn } from "./layout.ts";
import { emitContainerEvent } from "../events.ts";
import {
  isPane,
  type PaneElement
} from "../pane/Pane.ts";
import {
  isPaneGroup,
  type PaneGroup
} from "../pane-group/PaneGroup.ts";
import {
  forwardResizeEvents,
  installResizeCursorStyles
} from "../resize.ts";
import {
  horizontalInsertionLine,
  verticalInsertionLine,
  type DragStack
} from "../../interaction/drag/DragSession.ts";
import type { Rect } from "../../geometry/Rect.ts";
import type { DropCandidate } from "../../interaction/drag/dropIndex.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import { NamespacedStore } from "../../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import {
  deriveKey,
  pageNamespace
} from "../../storage/keys.ts";
import { hiddenStyles } from "../../theme/styles/hiddenStyles.ts";

// CONSTANTS
const kZoneBand = 48;

export type DockSide = "bottom" | "left" | "right" | "top";
export type DockAlign = "end" | "start";
export type DockSlot = PaneElement | PaneGroup;

@customElement("jolly-dock")
export class Dock extends LitElement {
  static override styles = [
    dockStyles,
    hiddenStyles
  ];

  @property({ type: String, reflect: true })
  declare side: DockSide;

  @property({ type: String, reflect: true })
  declare align: DockAlign | null;

  @property({ type: Boolean, reflect: true })
  declare overlay: boolean;

  @property({ type: String, reflect: true })
  declare key: string;

  @property({ type: Number })
  declare size: number;

  @property({ type: Boolean, reflect: true })
  declare collapsible: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsed: boolean;

  @property({ type: Boolean, reflect: true })
  declare empty: boolean;

  @property({ type: Boolean, reflect: true })
  declare double: boolean;

  @property({ type: Boolean, reflect: true })
  declare split: boolean;

  @property({ type: Number, attribute: "min-size" })
  declare minSize: number;

  @property({ type: Number, attribute: "max-size" })
  declare maxSize: number;

  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @query(".resize-handle")
  declare _handle: HTMLDivElement;

  @query(".primary")
  declare _content: HTMLDivElement;

  @query(".secondary")
  declare _secondary: HTMLDivElement;

  @query("slot:not([name])")
  declare _slot: HTMLSlotElement;

  @query("slot[name=\"secondary\"]")
  declare _secondarySlot: HTMLSlotElement;

  #resizeHandle: ResizeHandle | null = null;
  #removeResizeListeners: (() => void) | null = null;
  #managed = false;
  #state = new NamespacedStore({
    isManaged: () => this.#managed,
    namespace: () => pageNamespace(
      this.storageKey,
      "jolly-dock",
      this.layoutKey
    ),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", {
        type: "dock",
        dock: this.layoutKey,
        size: this.size,
        collapsed: this.collapsed
      });
    }
  });

  get managed(): boolean {
    return this.#managed;
  }

  get layoutKey(): string {
    return this.key === "" ?
      deriveKey("jolly-dock", this.side) :
      this.key;
  }

  get axis(): "x" | "y" {
    return this.side === "left" || this.side === "right" ? "y" : "x";
  }

  get splittable(): boolean {
    return this.double && !this.overlay && this.axis === "y";
  }

  constructor() {
    super();

    this.side = "left";
    this.align = null;
    this.overlay = false;
    this.key = "";
    this.size = 240;
    this.collapsible = false;
    this.collapsed = false;
    this.empty = false;
    this.double = false;
    this.split = false;
    this.minSize = 120;
    this.maxSize = Number.POSITIVE_INFINITY;
    this.storageKey = "";
    this.storage = defaultStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
  }

  override render(): TemplateResult {
    return html`
      <div class="content column primary" part="content">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
      <div class="content column secondary" part="secondary">
        <slot name="secondary" @slotchange=${this.#onSlotChange}></slot>
      </div>
      <div
        class="resize-handle"
        part="resize-handle"
        aria-label="Resize dock"
        @dblclick=${this.#onDoubleClick}
        @keydown=${this.#onHandleKeyDown}
      ></div>
    `;
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (
      changed.has("overlay") &&
      this.overlay &&
      this.align === null
    ) {
      this.align = "start";
    }

    if (!this.hasUpdated) {
      this.#readOccupancy();
      if (!this.#managed) {
        this.#restore();
      }
    }
    else if (
      changed.has("double") ||
      changed.has("overlay") ||
      changed.has("side")
    ) {
      this.#readOccupancy();
    }
  }

  protected override firstUpdated(): void {
    this.#applySize();
    this.#connectResizeHandle();
    installResizeCursorStyles(this.ownerDocument);
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (
      changed.has("side") ||
      changed.has("minSize") ||
      changed.has("maxSize") ||
      changed.has("overlay") ||
      changed.has("split")
    ) {
      this.#connectResizeHandle();
    }

    if (
      changed.has("size") ||
      changed.has("collapsed") ||
      changed.has("empty") ||
      changed.has("side") ||
      changed.has("overlay") ||
      changed.has("split")
    ) {
      this.#applySize();
    }
  }

  override disconnectedCallback(): void {
    this.#disconnectResizeHandle();
    super.disconnectedCallback();
  }

  slots(
    column?: DockColumn
  ): DockSlot[] {
    if (column === undefined) {
      return [
        ...this.slots("primary"),
        ...this.slots("secondary")
      ];
    }

    const secondary = column === "secondary";
    const slot = secondary ? this._secondarySlot : this._slot;
    const elements = this.hasUpdated ?
      slot.assignedElements({ flatten: true }) :
      [...this.children].filter(
        (element) => (element.getAttribute("slot") === "secondary") === secondary
      );

    return elements.filter(
      (element): element is DockSlot => isPane(element) || isPaneGroup(element)
    );
  }

  panes(): PaneElement[] {
    return this.slots().flatMap(
      (slot) => (isPaneGroup(slot) ? slot.panes() : [slot])
    );
  }

  acceptsSecondary(
    dragged: PaneElement
  ): boolean {
    if (!this.splittable || this.collapsed) {
      return false;
    }

    return this.split ||
      this.slots("primary").some((slot) => slot !== dragged);
  }

  dropZone(
    column: DockColumn = "primary"
  ): Rect {
    if (column === "secondary") {
      return this.#secondaryZone();
    }

    const rect = this.split ?
      this._content.getBoundingClientRect() :
      this.getBoundingClientRect();
    const vertical = this.side === "left" || this.side === "right";
    const thickness = vertical ? rect.width : rect.height;
    const span = vertical ? rect.height : rect.width;

    if (thickness > 0) {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    }

    if (span === 0) {
      return this.#viewportBand(vertical);
    }

    return vertical ?
      {
        x: this.side === "left" ? rect.x : rect.right - kZoneBand,
        y: rect.y,
        width: kZoneBand,
        height: rect.height
      } :
      {
        x: rect.x,
        y: this.side === "top" ? rect.y : rect.bottom - kZoneBand,
        width: rect.width,
        height: kZoneBand
      };
  }

  previewZone(
    column: DockColumn = "primary"
  ): Rect | undefined {
    const size = Math.min(Math.max(this.size, this.minSize), this.maxSize);
    if (column === "secondary") {
      if (this.split) {
        return undefined;
      }

      const zone = this.#secondaryZone();

      return {
        x: this.side === "left" ? zone.x : zone.x + zone.width - size,
        y: zone.y,
        width: size,
        height: zone.height
      };
    }

    const rect = this.getBoundingClientRect();
    const vertical = this.axis === "y";
    if ((vertical ? rect.width : rect.height) > 0) {
      return undefined;
    }

    const zone = this.dropZone();
    if (vertical) {
      return {
        x: this.side === "left" ? zone.x : zone.x + zone.width - size,
        y: zone.y,
        width: size,
        height: zone.height
      };
    }

    return {
      x: zone.x,
      y: this.side === "top" ? zone.y : zone.y + zone.height - size,
      width: zone.width,
      height: size
    };
  }

  dropStacks(
    dragged: PaneElement,
    column: DockColumn = "primary"
  ): DragStack[] {
    const stacks: DragStack[] = [];
    const slots = this.slots(column);
    for (let slot = 0; slot < slots.length; slot++) {
      const element = slots[slot];
      if (isPaneGroup(element)) {
        const source = element.panes().indexOf(dragged);
        stacks.push({
          slot,
          rect: element.tabsRect(),
          candidates: element.tabCandidates(),
          source: source === -1 ? null : source,
          line: (index) => element.tabLine(index)
        });
        continue;
      }
      if (element === dragged) {
        continue;
      }

      const header = element.headerRect();
      const candidates = [
        {
          start: header.x,
          size: header.width
        }
      ];
      stacks.push({
        slot,
        rect: {
          x: header.x,
          y: header.y,
          width: header.width,
          height: header.height
        },
        candidates,
        source: null,
        line: (index) => horizontalInsertionLine(header, candidates, index)
      });
    }

    return stacks;
  }

  dropCandidates(
    column: DockColumn = "primary"
  ): DropCandidate[] {
    return this.slots(column).map((slot) => {
      const rect = slot.getBoundingClientRect();
      const size = slot.occupiedSize(this.axis);

      return this.axis === "y" ?
        {
          start: rect.y,
          size
        } :
        {
          start: rect.x,
          size
        };
    });
  }

  insertionLine(
    index: number,
    column: DockColumn = "primary"
  ): Rect {
    const bounds = this.#insertionBounds(column);
    const candidates = this.dropCandidates(column);

    return this.axis === "y" ?
      verticalInsertionLine(bounds, candidates, index) :
      horizontalInsertionLine(bounds, candidates, index);
  }

  #insertionBounds(
    column: DockColumn
  ): Rect {
    const element = column === "primary" ? this._content : this._secondary;
    const rect = element?.getBoundingClientRect() ??
      this.getBoundingClientRect();
    const thickness = this.axis === "y" ? rect.width : rect.height;
    if (thickness === 0) {
      return this.previewZone(column) ?? this.dropZone(column);
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }

  #secondaryZone(): Rect {
    if (this.split) {
      const rect = this._secondary.getBoundingClientRect();

      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    }

    const rect = this.getBoundingClientRect();

    return {
      x: this.side === "left" ? rect.right : rect.x - kZoneBand,
      y: rect.y,
      width: kZoneBand,
      height: rect.height
    };
  }

  #readOccupancy(): void {
    this.empty = this.slots().length === 0;
    this.split = this.splittable && this.slots("secondary").length > 0;
  }

  #viewportBand(
    vertical: boolean
  ): Rect {
    const view = this.ownerDocument.defaultView;
    const viewWidth = view?.innerWidth ?? 0;
    const viewHeight = view?.innerHeight ?? 0;

    return vertical ?
      {
        x: this.side === "left" ? 0 : viewWidth - kZoneBand,
        y: 0,
        width: kZoneBand,
        height: viewHeight
      } :
      {
        x: 0,
        y: this.side === "top" ? 0 : viewHeight - kZoneBand,
        width: viewWidth,
        height: kZoneBand
      };
  }

  #onSlotChange = () => {
    this.#readOccupancy();
  };

  #connectResizeHandle(): void {
    if (!this.hasUpdated) {
      return;
    }

    this.#disconnectResizeHandle();

    this.#resizeHandle = new ResizeHandle(this, {
      direction: this.side,
      handle: this._handle,
      minSize: this.minSize * this.#columns(),
      maxSize: this.maxSize * this.#columns()
    });
    this.#removeResizeListeners = forwardResizeEvents(
      this,
      this.#resizeHandle,
      () => this.#resizeDetail(),
      () => {
        this.#readSize();
        this.#persist();
      }
    );
  }

  #disconnectResizeHandle(): void {
    this.#removeResizeListeners?.();
    this.#removeResizeListeners = null;
    this.#resizeHandle?.dispose();
    this.#resizeHandle = null;
  }

  #onDoubleClick = (
    event: MouseEvent
  ) => {
    if (event.button === 0 && this.collapsible && !this.empty) {
      this.#toggleCollapsed();
    }
  };

  #onHandleKeyDown = (
    event: KeyboardEvent
  ) => {
    if (event.key !== "Enter" || !this.collapsible || this.empty) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.#toggleCollapsed();
  };

  #toggleCollapsed(): void {
    if (!this.collapsed) {
      this.#readSize();
    }
    this.collapsed = !this.collapsed;
    this.#applySize();
    this.#persist();
    emitContainerEvent(
      this,
      "jolly-resize",
      this.#resizeDetail()
    );
    emitContainerEvent(
      this,
      "jolly-resize-end",
      this.#resizeDetail()
    );
  }

  #readSize(): void {
    if (this.collapsed) {
      return;
    }

    const measured = this.getBoundingClientRect()[this.#dimension()] /
      this.#columns();
    if (measured > 0) {
      this.size = Math.min(
        Math.max(measured, this.minSize),
        this.maxSize
      );
    }
  }

  #applySize(): void {
    const dimension = this.#dimension();
    const inert = this.collapsed || (this.empty && !this.overlay);
    this._handle?.classList.toggle("disabled", inert);

    if (inert) {
      this.style[dimension] = "0px";

      return;
    }

    this.style[dimension] = `${Math.min(
      Math.max(this.size, this.minSize),
      this.maxSize
    ) * this.#columns()}px`;
  }

  #columns(): number {
    return this.split ? 2 : 1;
  }

  #restore(): void {
    const size = this.#state.readNumber("size");
    if (size !== null && size > 0) {
      this.size = size;
    }

    this.collapsed = this.#state.readBoolean("collapsed") === true;
  }

  #persist(): void {
    this.#state.writeNumber("size", this.size);
    this.#state.writeBoolean("collapsed", this.collapsed);
  }

  #resizeDetail() {
    const rect = this.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
      collapsed: this.collapsed
    };
  }

  #dimension(): "height" | "width" {
    return this.side === "left" || this.side === "right" ?
      "width" :
      "height";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dock": Dock;
  }
}

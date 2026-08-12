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
import { emitContainerEvent } from "./events.ts";
import {
  isPane,
  type PaneElement
} from "./Pane.ts";
import {
  forwardResizeEvents,
  installResizeCursorStyles
} from "./resize.ts";
import {
  horizontalInsertionLine,
  verticalInsertionLine
} from "../interaction/drag/DragSession.ts";
import type { Rect } from "../geometry/Rect.ts";
import type { DropCandidate } from "../interaction/drag/dropIndex.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import { PersistedState } from "../storage/PersistedState.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import { deriveKey } from "../storage/keys.ts";

// CONSTANTS
const kZoneBand = 48;

export type DockSide = "bottom" | "left" | "right" | "top";
export type DockAlign = "end" | "start";

@customElement("jolly-dock")
export class Dock extends LitElement {
  static override styles = [
    dockStyles
  ];

  @property({ type: String, reflect: true })
  declare side: DockSide;

  /**
   * Packs panes toward one edge instead of stretching them.
   *
   * Unset keeps the historical behaviour, where panes share the main axis and
   * a lone pane fills the dock. Setting it switches to content-sized panes,
   * which is what makes folding visible and what `grow` opts back out of.
   */
  @property({ type: String, reflect: true })
  declare align: DockAlign | null;

  /**
   * Detaches the dock from the flow so its panes float over the content.
   */
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

  /**
   * Reflected so an emptied dock can drop its surface and its width.
   */
  @property({ type: Boolean, reflect: true })
  declare empty: boolean;

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

  @query(".content")
  declare _content: HTMLDivElement;

  @query("slot")
  declare _slot: HTMLSlotElement;

  #resizeHandle: ResizeHandle | null = null;
  #removeResizeListeners: (() => void) | null = null;
  #managed = false;
  #state = new PersistedState(this, {
    isManaged: () => this.#managed,
    namespace: () => this.#namespace(),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", undefined);
    }
  });

  /**
   * True while the dock is inside a `jolly-dock-layout`, which then owns its
   * persistence. Resolved at connect so it beats the first render.
   */
  get managed(): boolean {
    return this.#managed;
  }

  /**
   * Identity used by the layout snapshot, falling back to tag and side.
   */
  get layoutKey(): string {
    return this.key === "" ?
      deriveKey("jolly-dock", this.side) :
      this.key;
  }

  /**
   * Axis panes stack along, which is the opposite of the resized one.
   */
  get axis(): "x" | "y" {
    return this.side === "left" || this.side === "right" ? "y" : "x";
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
    this.minSize = 120;
    this.maxSize = Number.POSITIVE_INFINITY;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
  }

  override render(): TemplateResult {
    return html`
      <div class="content" part="content">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
      ${this.overlay
        ? null
        : html`
          <div
            class="resize-handle"
            part="resize-handle"
            aria-label="Resize dock"
            @dblclick=${this.#onDoubleClick}
            @keydown=${this.#onHandleKeyDown}
          ></div>
        `}
    `;
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    // An overlay dock is content-sized by definition; stretching would leave
    // one pane covering the whole viewport edge.
    if (changed.has("overlay") && this.overlay && this.align === null) {
      this.align = "start";
    }
  }

  protected override firstUpdated(): void {
    if (!this.#managed) {
      this.#restore();
    }
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
      changed.has("overlay")
    ) {
      this.#connectResizeHandle();
    }

    if (
      changed.has("size") ||
      changed.has("collapsed") ||
      changed.has("empty") ||
      changed.has("side") ||
      changed.has("overlay")
    ) {
      this.#applySize();
    }
  }

  override disconnectedCallback(): void {
    this.#disconnectResizeHandle();
    super.disconnectedCallback();
  }

  /**
   * Panes slotted into the dock, in DOM order.
   */
  panes(): PaneElement[] {
    if (!this.hasUpdated) {
      return [...this.children].filter(isPane);
    }

    return this._slot.assignedElements({ flatten: true })
      .filter(isPane);
  }

  /**
   * Region that arms the dock while a drag runs.
   *
   * A dock with a box of its own takes the drop across the whole of it,
   * wherever the dragged pane comes from. Aiming at a dock means aiming at the
   * dock, not at a strip of it, and a pane that has to be parked in a window
   * first before it can be moved one dock over is a gesture in two halves.
   *
   * A dock with no thickness left is the exception, since there is no surface
   * to aim at: an emptied or collapsed one gave its thickness back but is
   * still laid out where it belongs, so a band grows inward from the line it
   * collapsed to and the dock stays a target wherever on the page its layout
   * sits. Only a dock with no box at all falls back to the viewport edge.
   */
  dropZone(): Rect {
    const rect = this.getBoundingClientRect();
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

  /**
   * Main-axis extents of the slotted panes, ordered along `axis`.
   *
   * A pane is measured by what it occupies rather than by the box it was
   * given, so the space a stretched pane holds but does not fill counts as
   * dock rather than as pane. Both the drop index and the insertion line read
   * these, so where the drop resolves and where it is drawn cannot disagree.
   */
  dropCandidates(): DropCandidate[] {
    return this.panes().map((pane) => {
      const rect = pane.getBoundingClientRect();
      const size = pane.occupiedSize(this.axis);

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

  /**
   * Client rect of the insertion line for a drop index.
   */
  insertionLine(
    index: number
  ): Rect {
    const bounds = this.#insertionBounds();
    const candidates = this.dropCandidates();

    return this.axis === "y" ?
      verticalInsertionLine(bounds, candidates, index) :
      horizontalInsertionLine(bounds, candidates, index);
  }

  /**
   * Box the insertion line is drawn across.
   *
   * An emptied dock has no content box left to draw over, so the line spans
   * the band that armed it instead of collapsing to nothing.
   */
  #insertionBounds(): Rect {
    const rect = this._content?.getBoundingClientRect() ??
      this.getBoundingClientRect();
    const thickness = this.axis === "y" ? rect.width : rect.height;
    if (thickness === 0) {
      return this.dropZone();
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
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
    this.empty = this.panes().length === 0;
  };

  #connectResizeHandle(): void {
    if (!this.hasUpdated) {
      return;
    }

    this.#disconnectResizeHandle();

    // An overlay dock paints no edge, so there is nothing to grab.
    if (this.overlay) {
      return;
    }

    this.#resizeHandle = new ResizeHandle(this, {
      direction: this.side,
      handle: this._handle,
      minSize: this.minSize,
      maxSize: this.maxSize
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
    if (event.button === 0 && this.collapsible) {
      this.#toggleCollapsed();
    }
  };

  #onHandleKeyDown = (
    event: KeyboardEvent
  ) => {
    if (event.key !== "Enter" || !this.collapsible) {
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
    const measured = this.getBoundingClientRect()[this.#dimension()];
    if (measured > 0) {
      this.size = Math.min(
        Math.max(measured, this.minSize),
        this.maxSize
      );
    }
  }

  #applySize(): void {
    const dimension = this.#dimension();
    if (
      this.collapsed ||
      (this.empty && !this.overlay)
    ) {
      this.style[dimension] = "0px";

      return;
    }

    this.style[dimension] = `${Math.min(
      Math.max(this.size, this.minSize),
      this.maxSize
    )}px`;
  }

  #restore(): void {
    const size = Number(this.#state.read("size"));
    if (
      Number.isFinite(size) &&
      size > 0
    ) {
      this.size = size;
    }

    this.collapsed = this.#state.read("collapsed") === "true";
  }

  #persist(): void {
    this.#state.write(
      "size",
      String(this.size)
    );
    this.#state.write(
      "collapsed",
      String(this.collapsed)
    );
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

  #namespace(): string {
    if (this.storageKey !== "") {
      return this.storageKey;
    }

    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-dock:${this.layoutKey}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dock": Dock;
  }
}

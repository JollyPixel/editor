// Import Third-party Dependencies
import {
  CornerResizeHandle,
  ResizeHandle,
  type ResizeHandleLike
} from "@jolly-pixel/resize-handle";
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
import { emitContainerEvent } from "./events.ts";
import { floatingStyles } from "./Floating.styles.ts";
import {
  isPane,
  type PaneDragDetail,
  type PaneElement
} from "./Pane.ts";
import {
  forwardResizeEvents,
  installResizeCursorStyles
} from "./resize.ts";
import {
  isDocumentOrShadowRoot
} from "../dom.ts";
import { startDragSession } from "../interaction/drag/DragSession.ts";
import { clampToViewport } from "../geometry/clampToViewport.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import { PersistedState } from "../storage/PersistedState.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import { deriveKey } from "../storage/keys.ts";

// CONSTANTS
const kRootStack = new WeakMap<Document | ShadowRoot, number>();
const kOwnedZIndex = "var(--jolly-floating-stack)";

@customElement("jolly-floating")
export class Floating extends LitElement {
  static override styles = [
    floatingStyles
  ];

  @property({ type: Number, reflect: true })
  declare x: number;

  @property({ type: Number, reflect: true })
  declare y: number;

  @property({ type: Number, reflect: true })
  declare width: number;

  @property({ type: Number, reflect: true })
  declare height: number;

  @property({ type: Number, attribute: "min-width" })
  declare minWidth: number;

  @property({ type: Number, attribute: "min-height" })
  declare minHeight: number;

  /**
   * Ghosts the window while a layout drags it, so what it passes over stays
   * visible. Set by whoever runs the drag, not by the author.
   */
  @property({ type: Boolean, reflect: true })
  declare dragging: boolean;

  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @query("slot")
  declare _slot: HTMLSlotElement;

  @query(".right")
  declare _rightHandle: HTMLDivElement;

  @query(".bottom")
  declare _bottomHandle: HTMLDivElement;

  @query(".corner")
  declare _cornerHandle: HTMLDivElement;

  #resizeHandles: ResizeHandleLike[] = [];
  #removeResizeListeners: Array<() => void> = [];
  #ownsZIndex = false;
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
   * True inside a `jolly-dock-layout`, which then owns movement and
   * persistence so a drag can also end in a dock.
   */
  get managed(): boolean {
    return this.#managed;
  }

  /**
   * Identity used by the layout snapshot, taken from the pane it holds.
   */
  get layoutKey(): string {
    return this.pane()?.layoutKey ?? deriveKey("jolly-floating", "");
  }

  constructor() {
    super();

    this.x = 8;
    this.y = 8;
    this.width = 320;
    this.height = 360;
    this.minWidth = 160;
    this.minHeight = 80;
    this.dragging = false;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
  }

  override render(): TemplateResult {
    return html`
      <div class="content" @jolly-pane-drag=${this.#onPaneDrag}>
        <slot></slot>
      </div>
      <div
        class="resize-handle right"
        part="resize-handle-right"
        aria-label="Resize floating pane width"
      ></div>
      <div
        class="resize-handle bottom"
        part="resize-handle-bottom"
        aria-label="Resize floating pane height"
      ></div>
      <div
        class="resize-handle corner bottom-right"
        part="resize-handle-corner"
        aria-hidden="true"
      ></div>
    `;
  }

  protected override firstUpdated(): void {
    if (!this.#managed) {
      this.#restore();
    }
    this.#applyGeometry();
    this.#connectResizeHandles();
    this.addEventListener("pointerdown", this.#raise);
    this.addEventListener("focusin", this.#raise);
    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.clampToView
    );
    installResizeCursorStyles(this.ownerDocument);
    this.clampToView();
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (
      changed.has("x") ||
      changed.has("y") ||
      changed.has("width") ||
      changed.has("height")
    ) {
      this.#applyGeometry();
    }

    if (
      changed.has("minWidth") ||
      changed.has("minHeight")
    ) {
      this.#connectResizeHandles();
    }
  }

  override disconnectedCallback(): void {
    this.#disconnectResizeHandles();
    this.removeEventListener("pointerdown", this.#raise);
    this.removeEventListener("focusin", this.#raise);
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.clampToView
    );
    super.disconnectedCallback();
  }

  /**
   * The pane this window holds, if any.
   */
  pane(): PaneElement | null {
    const children = this.hasUpdated ?
      this._slot.assignedElements({ flatten: true }) :
      [...this.children];

    return children.find(isPane) ?? null;
  }

  /**
   * Places the window at a viewport position, clamped to stay reachable.
   */
  moveTo(
    x: number,
    y: number
  ): void {
    this.x = x;
    this.y = y;
    this.clampToView();
  }

  /**
   * Brings the window above its siblings in the same root.
   */
  raise(): void {
    this.#raise();
  }

  clampToView = () => {
    const rect = this.getBoundingClientRect();
    const view = this.ownerDocument.defaultView;
    if (view === null) {
      return;
    }

    const position = clampToViewport({
      x: this.x,
      y: this.y,
      rect,
      viewport: {
        width: view.innerWidth,
        height: view.innerHeight
      }
    });
    this.x = position.x;
    this.y = position.y;
  };

  /**
   * Moves the window from its pane header when no layout owns the gesture.
   *
   * A managed window ignores this: the layout runs the session instead, so
   * the same drag can end in a dock rather than only somewhere else on screen.
   */
  #onPaneDrag = (
    event: CustomEvent<PaneDragDetail>
  ) => {
    if (this.#managed) {
      return;
    }

    event.stopPropagation();
    const { detail } = event;
    const startX = this.x;
    const startY = this.y;
    const originX = detail.event.clientX;
    const originY = detail.event.clientY;
    this.#raise();

    startDragSession({
      source: detail.pane,
      event: detail.event,
      handle: detail.handle,
      ghostLabel: detail.pane.heading,
      visuals: false,
      zones: () => [],
      onPreview: (result) => {
        this.moveTo(
          startX + result.x - originX,
          startY + result.y - originY
        );
        emitContainerEvent(this, "jolly-move", {
          x: this.x,
          y: this.y
        });
      },
      onCommit: () => {
        this.#persist();
        emitContainerEvent(this, "jolly-move-end", {
          x: this.x,
          y: this.y
        });
      },
      onCancel: () => {
        this.moveTo(startX, startY);
      }
    });
  };

  #connectResizeHandles(): void {
    if (!this.hasUpdated) {
      return;
    }

    this.#disconnectResizeHandles();
    const width = new ResizeHandle(this, {
      direction: "left",
      handle: this._rightHandle,
      minSize: this.minWidth
    });
    const height = new ResizeHandle(this, {
      direction: "top",
      handle: this._bottomHandle,
      minSize: this.minHeight
    });
    const corner = new CornerResizeHandle(this, {
      horizontal: "left",
      vertical: "top",
      handle: this._cornerHandle,
      minWidth: this.minWidth,
      minHeight: this.minHeight
    });
    this.#resizeHandles = [width, height, corner];
    for (const resizeHandle of this.#resizeHandles) {
      this.#removeResizeListeners.push(forwardResizeEvents(
        this,
        resizeHandle,
        () => this.#resizeDetail(),
        () => {
          this.#readSize();
          this.clampToView();
          this.#persist();
        }
      ));
      resizeHandle.addEventListener(
        "drag",
        this.#onResize
      );
    }
  }

  #disconnectResizeHandles(): void {
    for (const resizeHandle of this.#resizeHandles) {
      resizeHandle.removeEventListener(
        "drag",
        this.#onResize
      );
      resizeHandle.dispose();
    }
    for (const remove of this.#removeResizeListeners) {
      remove();
    }
    this.#resizeHandles = [];
    this.#removeResizeListeners = [];
  }

  #onResize = () => {
    this.#readSize();
    this.clampToView();
  };

  #raise = () => {
    if (
      this.style.zIndex !== "" &&
      (!this.#ownsZIndex || this.style.zIndex !== kOwnedZIndex)
    ) {
      this.#ownsZIndex = false;

      return;
    }

    const candidate = this.getRootNode();
    const root = isDocumentOrShadowRoot(candidate)
      ? candidate
      : this.ownerDocument;
    const next = (kRootStack.get(root) ?? 0) + 1;
    kRootStack.set(root, next);
    this.style.setProperty(
      "--jolly-floating-stack",
      String(next)
    );
    this.style.zIndex = kOwnedZIndex;
    this.#ownsZIndex = true;
  };

  #readSize(): void {
    const rect = this.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }

  #applyGeometry(): void {
    this.style.left = `${this.x}px`;
    this.style.top = `${this.y}px`;
    this.style.width = `${this.width}px`;
    this.style.height = `${this.height}px`;
  }

  #restore(): void {
    const values = ["x", "y", "width", "height"] as const;
    for (const key of values) {
      const stored = this.#state.read(key);
      if (stored === null) {
        continue;
      }

      const value = Number(stored);
      if (Number.isFinite(value)) {
        this[key] = value;
      }
    }
  }

  #persist(): void {
    const values = ["x", "y", "width", "height"] as const;
    for (const key of values) {
      this.#state.write(key, String(this[key]));
    }
  }

  #resizeDetail() {
    const rect = this.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
      collapsed: false
    };
  }

  #namespace(): string {
    if (this.storageKey !== "") {
      return this.storageKey;
    }

    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-floating:${this.layoutKey}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-floating": Floating;
  }
}

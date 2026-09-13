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
import { defaultStorageAdapter } from "../storage/defaultStorage.ts";
import { NamespacedStore } from "../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  deriveKey,
  pageNamespace
} from "../storage/keys.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

// CONSTANTS
const kRootStack = new WeakMap<Document | ShadowRoot, number>();
const kOwnedZIndex = "var(--jolly-floating-stack)";
const kGeometryKeys = ["x", "y", "width", "height"] as const;

@customElement("jolly-floating")
export class Floating extends LitElement {
  static override styles = [
    floatingStyles,
    hiddenStyles
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

  @property({ type: Boolean, reflect: true })
  declare dragging: boolean;

  @property({ type: Boolean, reflect: true })
  declare hidden: boolean;

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
  #collapsed = false;
  #state = new NamespacedStore({
    isManaged: () => this.#managed,
    namespace: () => pageNamespace(
      this.storageKey,
      "jolly-floating",
      this.layoutKey
    ),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", {
        type: "floating",
        pane: this.layoutKey,
        geometry: {
          x: this.x,
          y: this.y,
          width: this.width,
          height: this.height
        }
      });
    }
  });

  get managed(): boolean {
    return this.#managed;
  }

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
    this.hidden = false;
    this.storageKey = "";
    this.storage = defaultStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
  }

  override render(): TemplateResult {
    return html`
      <div
        class="content"
        @jolly-pane-drag=${this.#onPaneDrag}
        @jolly-toggle=${this.#onPaneToggle}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
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

  protected override willUpdate(): void {
    if (!this.hasUpdated) {
      if (!this.#managed) {
        this.#restore();
      }
      this.#applyGeometry();
      this.clampToView();
    }
  }

  protected override firstUpdated(): void {
    this.#connectResizeHandles();
    this.addEventListener("pointerdown", this.#raise);
    this.addEventListener("focusin", this.#raise);
    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.clampToView
    );
    installResizeCursorStyles(this.ownerDocument);

    this.#raise();
    this.#syncCollapsed();
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

    if (changed.get("hidden") !== undefined) {
      this.#state.writeBoolean("hidden", this.hidden);
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

  pane(): PaneElement | null {
    const children = this.hasUpdated ?
      this._slot.assignedElements({ flatten: true }) :
      [...this.children];

    return children.find(isPane) ?? null;
  }

  moveTo(
    x: number,
    y: number
  ): void {
    this.x = x;
    this.y = y;
    this.clampToView();
  }

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

  #onSlotChange = () => {
    this.#syncCollapsed();
  };

  #onPaneToggle = () => {
    this.#syncCollapsed();
  };

  #syncCollapsed(): void {
    const collapsed = this.pane()?.collapsed ?? false;
    this.#collapsed = collapsed;
    this.#applyGeometry();
    this._bottomHandle?.classList.toggle("disabled", collapsed);
    this._cornerHandle?.classList.toggle("disabled", collapsed);
  }

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
    if (this.#collapsed) {
      return;
    }
    this.height = rect.height;
  }

  #applyGeometry(): void {
    this.style.left = `${this.x}px`;
    this.style.top = `${this.y}px`;
    this.style.width = `${this.width}px`;
    this.style.height = this.#collapsed ?
      `${this.pane()?.headerRect().height ?? this.height}px` :
      `${this.height}px`;
  }

  #restore(): void {
    for (const key of kGeometryKeys) {
      const value = this.#state.readNumber(key);
      if (value !== null) {
        this[key] = value;
      }
    }

    const hidden = this.#state.readBoolean("hidden");
    if (hidden !== null) {
      this.hidden = hidden;
    }
  }

  #persist(): void {
    for (const key of kGeometryKeys) {
      this.#state.writeNumber(key, this[key]);
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
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-floating": Floating;
  }
}

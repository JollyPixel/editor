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
import { emitContainerEvent } from "./events.ts";
import { floatingStyles } from "./Floating.styles.ts";
import { type PaneElement } from "./Pane.ts";
import {
  forwardResizeEvents,
  installResizeCursorStyles
} from "./resize.ts";
import { isDocumentOrShadowRoot } from "../dom.ts";
import { clampToViewport } from "../numeric/clampToViewport.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";

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

  #resizeHandles: ResizeHandle[] = [];
  #removeResizeListeners: Array<() => void> = [];
  #moveHandle: HTMLElement | null = null;
  #pointerId: number | null = null;
  #startX = 0;
  #startY = 0;
  #startClientX = 0;
  #startClientY = 0;
  #ownsZIndex = false;

  constructor() {
    super();

    this.x = 8;
    this.y = 8;
    this.width = 320;
    this.height = 360;
    this.minWidth = 160;
    this.minHeight = 80;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
  }

  override render(): TemplateResult {
    return html`
      <div class="content">
        <slot @slotchange=${this.#connectMoveHandle}></slot>
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
    `;
  }

  protected override firstUpdated(): void {
    this.#restore();
    this.#applyGeometry();
    this.#connectResizeHandles();
    this.#connectMoveHandle();
    this.addEventListener("pointerdown", this.#raise);
    this.addEventListener("focusin", this.#raise);
    this.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.#clamp
    );
    installResizeCursorStyles(this.ownerDocument);
    this.#clamp();
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
    this.#disconnectMoveHandle();
    this.removeEventListener("pointerdown", this.#raise);
    this.removeEventListener("focusin", this.#raise);
    this.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.#clamp
    );
    super.disconnectedCallback();
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
    this.#resizeHandles = [width, height];
    for (const resizeHandle of this.#resizeHandles) {
      this.#removeResizeListeners.push(forwardResizeEvents(
        this,
        resizeHandle,
        () => this.#resizeDetail(),
        () => {
          this.#readSize();
          this.#clamp();
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
    this.#clamp();
  };

  #connectMoveHandle = () => {
    this.#disconnectMoveHandle();
    const pane = this._slot.assignedElements({ flatten: true })
      .find((element): element is PaneElement => element.tagName === "JOLLY-PANE");
    this.#moveHandle = pane?.renderRoot.querySelector<HTMLElement>(
      ".header .title"
    ) ?? null;
    this.#moveHandle?.addEventListener("pointerdown", this.#onMoveStart);
    if (this.#moveHandle !== null) {
      this.#moveHandle.style.cursor = "move";
      this.#moveHandle.style.touchAction = "none";
    }
  };

  #disconnectMoveHandle(): void {
    this.#moveHandle?.removeEventListener("pointerdown", this.#onMoveStart);
    this.#moveHandle = null;
  }

  #onMoveStart = (
    event: PointerEvent
  ) => {
    if (
      event.button !== 0 ||
      this.#pointerId !== null ||
      this.#moveHandle === null
    ) {
      return;
    }

    event.preventDefault();
    this.#raise();
    this.#pointerId = event.pointerId;
    this.#startX = this.x;
    this.#startY = this.y;
    this.#startClientX = event.clientX;
    this.#startClientY = event.clientY;
    this.#moveHandle.setPointerCapture(event.pointerId);
    this.#moveHandle.addEventListener(
      "pointermove",
      this.#onMove
    );
    this.#moveHandle.addEventListener(
      "pointerup",
      this.#onMoveEnd
    );
    this.#moveHandle.addEventListener(
      "pointercancel",
      this.#onMoveEnd
    );
  };

  #onMove = (
    event: PointerEvent
  ) => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    this.x = this.#startX + event.clientX - this.#startClientX;
    this.y = this.#startY + event.clientY - this.#startClientY;
    this.#clamp();
    emitContainerEvent(this, "jolly-move", {
      x: this.x,
      y: this.y
    });
  };

  #onMoveEnd = (
    event: PointerEvent
  ) => {
    if (event.pointerId !== this.#pointerId || this.#moveHandle === null) {
      return;
    }

    this.#moveHandle.releasePointerCapture(event.pointerId);
    this.#moveHandle.removeEventListener(
      "pointermove",
      this.#onMove
    );
    this.#moveHandle.removeEventListener(
      "pointerup",
      this.#onMoveEnd
    );
    this.#moveHandle.removeEventListener(
      "pointercancel",
      this.#onMoveEnd
    );
    this.#pointerId = null;
    this.#persist();
    emitContainerEvent(this, "jolly-move-end", {
      x: this.x,
      y: this.y
    });
  };

  #clamp = () => {
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
    this.style.setProperty("--jolly-floating-stack", String(next));
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
      const stored = this.storage.get(
        `${this.#namespace()}:${key}`
      );
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
    this.storage.set(
      `${this.#namespace()}:x`,
      String(this.x)
    );
    this.storage.set(
      `${this.#namespace()}:y`,
      String(this.y)
    );
    this.storage.set(
      `${this.#namespace()}:width`,
      String(this.width)
    );
    this.storage.set(
      `${this.#namespace()}:height`,
      String(this.height)
    );
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

    const pane = this.querySelector("jolly-pane");
    const title = pane?.title ?? "untitled";
    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-floating:${title}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-floating": Floating;
  }
}

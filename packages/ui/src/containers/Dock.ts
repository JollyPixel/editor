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
  forwardResizeEvents,
  installResizeCursorStyles
} from "./resize.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";

export type DockSide = "bottom" | "left" | "right" | "top";

@customElement("jolly-dock")
export class Dock extends LitElement {
  static override styles = [
    dockStyles
  ];

  @property({ type: String, reflect: true })
  declare side: DockSide;

  @property({ type: Boolean, reflect: true })
  declare collapsible: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsed: boolean;

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

  #resizeHandle: ResizeHandle | null = null;
  #removeResizeListeners: (() => void) | null = null;
  #expandedSize = 240;

  constructor() {
    super();

    this.side = "left";
    this.collapsible = false;
    this.collapsed = false;
    this.minSize = 120;
    this.maxSize = Number.POSITIVE_INFINITY;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
  }

  override render(): TemplateResult {
    return html`
      <div class="content" part="content"><slot></slot></div>
      <div
        class="resize-handle"
        part="resize-handle"
        aria-label="Resize dock"
        @dblclick=${this.#onDoubleClick}
        @keydown=${this.#onHandleKeyDown}
      ></div>
    `;
  }

  protected override firstUpdated(): void {
    this.#restore();
    this.#connectResizeHandle();
    installResizeCursorStyles(this.ownerDocument);
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (
      changed.has("side") ||
      changed.has("minSize") ||
      changed.has("maxSize")
    ) {
      this.#connectResizeHandle();
    }
  }

  override disconnectedCallback(): void {
    this.#disconnectResizeHandle();
    super.disconnectedCallback();
  }

  #connectResizeHandle(): void {
    if (!this.hasUpdated) {
      return;
    }

    this.#disconnectResizeHandle();
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
      () => this.#persist()
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
    const dimension = this.#dimension();
    if (this.collapsed) {
      this.style[dimension] = `${Math.min(
        Math.max(this.#expandedSize, this.minSize),
        this.maxSize
      )}px`;
      this.collapsed = false;
    }
    else {
      this.#expandedSize = this.getBoundingClientRect()[dimension];
      this.style[dimension] = "0px";
      this.collapsed = true;
    }

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

  #restore(): void {
    const dimension = this.#dimension();
    const size = Number(
      this.storage.get(`${this.#namespace()}:size`)
    );
    if (Number.isFinite(size) && size > 0) {
      this.#expandedSize = size;
    }

    this.collapsed = this.storage.get(
      `${this.#namespace()}:collapsed`
    ) === "true";
    this.style[dimension] = this.collapsed ?
      "0px" :
      `${this.#expandedSize}px`;
  }

  #persist(): void {
    const size = this.getBoundingClientRect()[
      this.#dimension()
    ];
    if (!this.collapsed && size > 0) {
      this.#expandedSize = size;
    }
    this.storage.set(
      `${this.#namespace()}:size`,
      String(this.#expandedSize)
    );
    this.storage.set(
      `${this.#namespace()}:collapsed`,
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

    const pane = this.querySelector("jolly-pane");
    const title = pane?.title ?? "untitled";
    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-dock:${this.side}:${title}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dock": Dock;
  }
}

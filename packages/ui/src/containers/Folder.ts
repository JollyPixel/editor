// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { emitContainerEvent } from "./events.ts";
import { folderStyles } from "./Folder.styles.ts";

// Registers the chevron and grip glyphs.
import "../icon/Icon.ts";
import { isButtonElement } from "../dom.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";

type ReorderCommand = "cancel" | "down" | "finish" | "start" | "up";

@customElement("jolly-folder")
export class Folder extends LitElement {
  static override styles = [
    folderStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare key: string;

  @property({ type: Boolean, reflect: true })
  declare open: boolean;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @state()
  declare _reordering: boolean;

  #persistenceKey = "";
  #pointerId: number | null = null;

  get persistenceKey(): string {
    return this.#persistenceKey;
  }

  set persistenceKey(
    value: string
  ) {
    if (this.#persistenceKey === value) {
      return;
    }

    this.#persistenceKey = value;
    this.#restoreOpen();
  }

  constructor() {
    super();

    this.label = "";
    this.key = "";
    this.open = true;
    this.reorderable = false;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
    this._reordering = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    queueMicrotask(
      () => this.#restoreOpen()
    );
  }

  override render(): TemplateResult {
    return html`
      <div class="header" part="header">
        <button
          class="toggle"
          type="button"
          aria-expanded=${String(this.open)}
          @click=${this.#toggle}
        ><jolly-icon
          class="chevron"
          name="chevron"
          aria-hidden="true"
        ></jolly-icon>${this.label}</button>
        <button
          class="grip"
          type="button"
          aria-label=${`Reorder ${this.label}`}
          aria-pressed=${String(this._reordering)}
          @pointerdown=${this.#onGripPointerDown}
          @keydown=${this.#onGripKeyDown}
        ><jolly-icon name="drag" aria-hidden="true"></jolly-icon></button>
      </div>
      <div class="content" part="content">
        <slot></slot>
      </div>
    `;
  }

  #toggle = () => {
    this.open = !this.open;
    this.storage.set(
      `${this.#namespace()}:open`,
      String(this.open)
    );
    emitContainerEvent(
      this,
      "jolly-toggle",
      { open: this.open }
    );
  };

  #restoreOpen(): void {
    const stored = this.storage.get(
      `${this.#namespace()}:open`
    );
    if (stored === "true" || stored === "false") {
      this.open = stored === "true";
    }
  }

  #onGripKeyDown = (
    event: KeyboardEvent
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      this._reordering = !this._reordering;
      this.#emitReorder(
        this._reordering ? "start" : "finish"
      );

      return;
    }
    if (!this._reordering) {
      return;
    }

    const commands: Partial<Record<string, ReorderCommand>> = {
      ArrowUp: "up",
      ArrowDown: "down",
      Escape: "cancel"
    };
    const command = commands[event.key];
    if (command === undefined) {
      return;
    }

    event.preventDefault();
    this.#emitReorder(command);
    if (command === "cancel") {
      this._reordering = false;
    }
  };

  #onGripPointerDown = (
    event: PointerEvent
  ) => {
    if (
      !isButtonElement(event.currentTarget) ||
      event.button !== 0 ||
      this.#pointerId !== null
    ) {
      return;
    }

    const grip = event.currentTarget;
    event.preventDefault();
    this.#pointerId = event.pointerId;
    grip.setPointerCapture(event.pointerId);
    grip.addEventListener(
      "pointermove",
      this.#onGripPointerMove
    );
    grip.addEventListener(
      "pointerup",
      this.#onGripPointerEnd
    );
    grip.addEventListener(
      "pointercancel",
      this.#onGripPointerEnd
    );
    this.#emitReorder("start");
  };

  #onGripPointerMove = (
    event: PointerEvent
  ) => {
    if (event.pointerId === this.#pointerId) {
      emitContainerEvent(this, "jolly-folder-reorder", {
        folder: this,
        command: "pointer",
        clientY: event.clientY
      });
    }
  };

  #onGripPointerEnd = (
    event: PointerEvent
  ) => {
    if (
      !isButtonElement(event.currentTarget) ||
      event.pointerId !== this.#pointerId
    ) {
      return;
    }

    const grip = event.currentTarget;
    grip.releasePointerCapture(event.pointerId);
    grip.removeEventListener(
      "pointermove",
      this.#onGripPointerMove
    );
    grip.removeEventListener(
      "pointerup",
      this.#onGripPointerEnd
    );
    grip.removeEventListener(
      "pointercancel",
      this.#onGripPointerEnd
    );
    this.#pointerId = null;
    this.#emitReorder("finish");
  };

  #emitReorder(
    command: ReorderCommand
  ): void {
    emitContainerEvent(this, "jolly-folder-reorder", {
      folder: this,
      command
    });
  }

  #namespace(): string {
    const folderName = this.key || this.label;

    return this.storageKey || this.persistenceKey || `jolly-folder:${folderName}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-folder": Folder;
  }
}

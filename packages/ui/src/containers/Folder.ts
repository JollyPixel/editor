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
import { PersistedState } from "../storage/PersistedState.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

type ReorderCommand =
  | "cancel"
  | "down"
  | "finish"
  | "start"
  | "up";

@customElement("jolly-folder")
export class Folder extends LitElement {
  static override styles = [
    folderStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare label: string;

  @property({ type: String })
  declare key: string;

  @property({ type: Boolean, reflect: true })
  declare open: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsible: boolean;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @property({ type: Boolean, reflect: true })
  declare dragging: boolean;

  @property({ type: Boolean, reflect: true })
  declare flush: boolean;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @state()
  declare _reordering: boolean;

  #persistenceKey = "";
  #state = new PersistedState(this, {
    isManaged: () => this.closest("jolly-dock-layout") !== null,
    namespace: () => this.#namespace(),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", undefined);
    }
  });

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
    this.collapsible = true;
    this.reorderable = false;
    this.dragging = false;
    this.flush = false;
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

  // A folder that cannot collapse has no way back open, so it stays open.
  protected override willUpdate(): void {
    if (!this.collapsible) {
      this.open = true;
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="header" part="header">
        ${this.collapsible ? this.#renderToggle() : this.#renderTitle()}
        <slot name="actions"></slot>
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

  #renderToggle(): TemplateResult {
    return html`<button
      class="toggle"
      type="button"
      aria-expanded=${String(this.open)}
      @click=${this.#toggle}
    ><jolly-icon
      class="chevron"
      name="chevron"
      aria-hidden="true"
    ></jolly-icon><span class="label">${this.label}</span></button>`;
  }

  #renderTitle(): TemplateResult {
    return html`<div class="title"><span
      class="gutter"
      aria-hidden="true"
    ></span><span class="label">${this.label}</span></div>`;
  }

  headerRect(): DOMRect {
    const header = this.renderRoot.querySelector(".header");

    return (header ?? this).getBoundingClientRect();
  }

  #toggle = () => {
    this.open = !this.open;
    this.#state.write("open", String(this.open));
    emitContainerEvent(
      this,
      "jolly-toggle",
      { open: this.open }
    );
  };

  #restoreOpen(): void {
    if (!this.collapsible) {
      return;
    }

    const stored = this.#state.read("open");
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
      !this.reorderable
    ) {
      return;
    }

    event.preventDefault();
    emitContainerEvent(this, "jolly-folder-drag", {
      folder: this,
      event
    });
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

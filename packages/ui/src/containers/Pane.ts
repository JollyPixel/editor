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
  query,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import { emitContainerEvent } from "./events.ts";
import { FolderListController } from "./FolderListController.ts";
import { paneStyles } from "./Pane.styles.ts";
import {
  isSlotElement
} from "../dom.ts";

// Registers the chevron and grip glyphs.
import "../icon/Icon.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import { PersistedState } from "../storage/PersistedState.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import { deriveKey } from "../storage/keys.ts";
import {
  providePresenceSource,
  type PresenceProvider
} from "../peer/presenceContext.ts";
import type { PresenceSource } from "../peer/PresenceSource.ts";
import { hiddenStyles } from "../theme/styles/hiddenStyles.ts";

// CONSTANTS
const kInteractive = "button, input, select, textarea, a";

export type PaneMoveCommand =
  | "cancel"
  | "down"
  | "finish"
  | "next"
  | "previous"
  | "start"
  | "up";

export interface PaneDragDetail {
  pane: PaneElement;
  event: PointerEvent;
  handle: HTMLElement;
}

/*
 * A pane consumes tokens and never declares them. Declaring them would put
 * "color-scheme: light dark" on every pane, which resets the scheme inherited
 * from the scope host and drops a nested pane back to the system preference
 * while everything around it stays on the chosen theme.
 */
@customElement("jolly-pane")
export class PaneElement extends LitElement {
  static override styles = [
    paneStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare heading: string;

  @property({ type: String, reflect: true })
  declare key: string;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsible: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsed: boolean;

  @property({ type: Boolean, reflect: true })
  declare grow: boolean;

  @property({ type: Boolean, reflect: true })
  declare dragging: boolean;

  @property({ type: Boolean, reflect: true })
  declare locked: boolean;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @property({ attribute: false })
  declare presence: PresenceSource | null;

  @state()
  declare _hasActions: boolean;

  @state()
  declare _announcement: string;

  @property({ type: Boolean, reflect: true })
  declare movable: boolean;

  @state()
  declare _grabbed: boolean;

  @query("slot:not([name])")
  declare _contentSlot: HTMLSlotElement;

  @query(".header")
  declare _header: HTMLElement;

  @query(".content")
  declare _content: HTMLElement;

  #managed = false;
  #state = new PersistedState(this, {
    isManaged: () => this.#managed,
    namespace: () => this.#namespace(),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", undefined);
    }
  });
  #hosted = false;
  #presenceProvider: PresenceProvider | null = null;
  #folders = new FolderListController(this, {
    content: () => this._content,
    contentSlot: () => this._contentSlot,
    namespace: () => this.#namespace(),
    reorderable: () => this.reorderable,
    storage: () => this.storage,
    announce: (message) => this.announce(message)
  });

  get layoutKey(): string {
    return this.key === "" ?
      deriveKey("jolly-pane", this.heading) :
      this.key;
  }

  constructor() {
    super();

    this.heading = "";
    this.key = "";
    this.reorderable = false;
    this.collapsible = false;
    this.collapsed = false;
    this.grow = false;
    this.dragging = false;
    this.locked = false;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
    this.presence = null;
    this._hasActions = false;
    this._announcement = "";
    this.movable = false;
    this._grabbed = false;
  }

  override disconnectedCallback(): void {
    this.#presenceProvider?.dispose();
    this.#presenceProvider = null;
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#presenceProvider = providePresenceSource(this, () => this.presence);
    this.#managed = this.closest("jolly-dock-layout") !== null;
    this.#hosted = this.#managed ||
      this.closest("jolly-floating") !== null;
    if (this.#hosted) {
      this.movable = !this.locked;
    }
    if (!this.#managed) {
      queueMicrotask(() => this.#restoreCollapsed());
    }
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (changed.has("presence")) {
      this.#presenceProvider?.notify();
    }
    if (
      this.#hosted &&
      changed.has("locked")
    ) {
      this.movable = !this.locked;
    }
  }

  override render(): TemplateResult {
    const showHeader = this.heading !== "" ||
      this._hasActions ||
      this.collapsible ||
      this.movable;

    return html`
      ${showHeader
        ? html`
          <header
            class="header"
            part="header"
            @pointerdown=${this.#onHeaderPointerDown}
          >
            ${this.collapsible
              ? html`
                <button
                  class="fold"
                  type="button"
                  aria-expanded=${String(!this.collapsed)}
                  aria-label=${`Fold ${this.heading || "pane"}`}
                  @click=${this.#toggleCollapsed}
                ><jolly-icon
                  class="chevron"
                  name="chevron"
                  aria-hidden="true"
                ></jolly-icon></button>
              `
              : nothing}
            <span class="title" part="title">${this.heading}</span>
            <span class="actions" part="actions">
              <slot name="actions" @slotchange=${this.#onActionsChange}></slot>
            </span>
            ${this.movable
              ? html`
                <button
                  class="grip"
                  type="button"
                  aria-label=${`Move ${this.heading || "pane"}`}
                  aria-pressed=${String(this._grabbed)}
                  @pointerdown=${this.#onGripPointerDown}
                  @keydown=${this.#onGripKeyDown}
                ><jolly-icon name="drag" aria-hidden="true"></jolly-icon></button>
              `
              : nothing}
          </header>
        `
        : html`
          <slot
            name="actions"
            hidden
            @slotchange=${this.#onActionsChange}
          ></slot>
        `}
      <div class="content" part="content">
        <slot
          @slotchange=${this.#folders.onContentChange}
          @jolly-folder-reorder=${this.#folders.onReorderCommand}
          @jolly-folder-drag=${this.#folders.onFolderDrag}
        ></slot>
      </div>
      <span class="live-region" aria-live="polite">${this._announcement}</span>
    `;
  }

  announce(
    message: string
  ): void {
    this._announcement = message;
  }

  folderStates(): Record<string, { open: boolean; }> {
    return this.#folders.states();
  }

  applyFolderStates(
    states: Readonly<Record<string, { open: boolean; }>>
  ): void {
    this.#folders.applyStates(states);
  }

  headerRect(): DOMRect {
    return (
      this._header ?? this
    ).getBoundingClientRect();
  }

  occupiedSize(
    axis: "x" | "y"
  ): number {
    const rect = this.getBoundingClientRect();
    if (axis === "x") {
      return rect.width;
    }

    const children = this._contentSlot?.assignedElements({ flatten: true }) ?? [];
    if (children.length === 0) {
      return rect.height;
    }

    /*
     * Folded content measures nothing, and reordered children are not in
     * document order, so the header is the floor and every child is asked.
     */
    let bottom = this._header?.getBoundingClientRect().bottom ?? rect.top;
    for (const child of children) {
      bottom = Math.max(bottom, contentBottom(child));
    }

    return Math.min(bottom - rect.top, rect.height);
  }

  #toggleCollapsed = () => {
    this.collapsed = !this.collapsed;
    this.#state.write(
      "collapsed",
      String(this.collapsed)
    );

    emitContainerEvent(
      this,
      "jolly-toggle",
      { open: !this.collapsed }
    );
  };

  #restoreCollapsed(): void {
    const stored = this.#state.read("collapsed");

    if (
      stored === "true" ||
      stored === "false"
    ) {
      this.collapsed = stored === "true";
    }
  }

  #onHeaderPointerDown = (
    event: PointerEvent
  ) => {
    if (
      event.button !== 0 ||
      !this.movable ||
      isInteractiveTarget(event)
    ) {
      return;
    }

    this.#requestDrag(
      event,
      this._header
    );
  };

  #onGripPointerDown = (
    event: PointerEvent
  ) => {
    if (event.button !== 0 || !this.movable) {
      return;
    }

    event.stopPropagation();
    this.#requestDrag(
      event,
      event.currentTarget instanceof HTMLElement ?
        event.currentTarget :
        this._header
    );
  };

  #requestDrag(
    event: PointerEvent,
    handle: HTMLElement
  ): void {
    event.preventDefault();
    emitContainerEvent(this, "jolly-pane-drag", {
      pane: this,
      event,
      handle
    });
  }

  #onGripKeyDown = (
    event: KeyboardEvent
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      this._grabbed = !this._grabbed;
      this.#emitMove(
        this._grabbed ? "start" : "finish"
      );

      return;
    }
    if (!this._grabbed) {
      return;
    }

    const commands: Partial<Record<string, PaneMoveCommand>> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "previous",
      ArrowRight: "next",
      Escape: "cancel"
    };
    const command = commands[event.key];
    if (command === undefined) {
      return;
    }

    event.preventDefault();
    this.#emitMove(command);
    if (command === "cancel") {
      this._grabbed = false;
    }
  };

  #emitMove(
    command: PaneMoveCommand
  ): void {
    emitContainerEvent(this, "jolly-pane-move", {
      pane: this,
      command
    });
  }

  #onActionsChange = (
    event: Event
  ) => {
    if (isSlotElement(event.currentTarget)) {
      this._hasActions = event.currentTarget.assignedElements().length > 0;
    }
  };

  #namespace(): string {
    if (this.storageKey !== "") {
      return this.storageKey;
    }

    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-pane:${this.heading || "untitled"}`;
  }
}

export function isPane(
  element: Element
): element is PaneElement {
  return element.tagName === "JOLLY-PANE";
}

function contentBottom(
  element: Element
): number {
  const rect = element.getBoundingClientRect();
  if (getComputedStyle(element).display !== "contents") {
    return rect.bottom;
  }

  let bottom = Number.NEGATIVE_INFINITY;
  for (const child of element.shadowRoot?.children ?? element.children) {
    bottom = Math.max(bottom, contentBottom(child));
  }

  return bottom === Number.NEGATIVE_INFINITY ? rect.bottom : bottom;
}

function isInteractiveTarget(
  event: PointerEvent
): boolean {
  const { target } = event;

  return target instanceof Element &&
    target.closest(kInteractive) !== null;
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-pane": PaneElement;
  }
}

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
import { emitContainerEvent } from "../events.ts";
import { FolderListController } from "./FolderListController.ts";
import { paneStyles } from "./Pane.styles.ts";
import {
  isSlotElement
} from "../../dom.ts";
import "../../icon/Icon.ts";
import type { IconName } from "../../icon/registry.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import { NamespacedStore } from "../../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import {
  deriveKey,
  pageNamespace
} from "../../storage/keys.ts";
import {
  providePresenceSource,
  type PresenceProvider
} from "../../peer/presenceContext.ts";
import type { PresenceSource } from "../../peer/PresenceSource.ts";
import { hiddenStyles } from "../../theme/styles/hiddenStyles.ts";

// CONSTANTS
const kInteractive = "button, input, select, textarea, a";
const kGrabbedCommands: Partial<Record<string, PaneMoveCommand>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "previous",
  ArrowRight: "next",
  Escape: "cancel"
};
const kJoinCommands: Partial<Record<string, PaneMoveCommand>> = {
  ArrowUp: "join-previous",
  ArrowDown: "join-next"
};

export type PaneMoveCommand =
  | "cancel"
  | "down"
  | "finish"
  | "join-next"
  | "join-previous"
  | "next"
  | "previous"
  | "start"
  | "up";

export interface PaneDragDetail {
  pane: PaneElement;
  event: PointerEvent;
  handle: HTMLElement;
}

@customElement("jolly-pane")
export class PaneElement extends LitElement {
  static override styles = [
    paneStyles,
    hiddenStyles
  ];

  @property({ type: String })
  declare heading: string;

  @property({ type: String })
  declare icon: IconName;

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

  @property({ type: Boolean, reflect: true })
  declare grouped: boolean;

  @property({ type: Boolean, reflect: true })
  declare inactive: boolean;

  @property({
    type: Number,
    attribute: "float-width"
  })
  declare floatWidth: number | undefined;

  @property({
    type: Number,
    attribute: "float-height"
  })
  declare floatHeight: number | undefined;

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
  #state = new NamespacedStore({
    isManaged: () => this.#managed,
    namespace: () => this.#namespace(),
    storage: () => this.storage,
    onManagedWrite: () => {
      emitContainerEvent(this, "jolly-layout-dirty", {
        type: "pane",
        pane: this.layoutKey,
        collapsed: this.collapsed
      });
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
    announce: (message) => this.announce(message),
    toggled: (folder, open) => {
      if (this.#managed) {
        emitContainerEvent(this, "jolly-layout-dirty", {
          type: "folder",
          pane: this.layoutKey,
          folder,
          open
        });
      }
    },
    discovered: () => {
      if (this.#managed) {
        emitContainerEvent(this, "jolly-pane-folders", {
          pane: this
        });
      }
    }
  });

  get layoutKey(): string {
    return this.key === "" ?
      deriveKey("jolly-pane", this.heading) :
      this.key;
  }

  constructor() {
    super();

    this.heading = "";
    this.icon = "";
    this.key = "";
    this.reorderable = false;
    this.collapsible = false;
    this.collapsed = false;
    this.grow = false;
    this.dragging = false;
    this.locked = false;
    this.grouped = false;
    this.inactive = false;
    this.storageKey = "";
    this.storage = defaultStorageAdapter();
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
    this.grouped = this.parentElement?.tagName === "JOLLY-PANE-GROUP";
    if (!this.grouped) {
      this.inactive = false;
    }
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
    const chrome = !this.grouped;
    const showHeader = chrome ?
      this.heading !== "" ||
      this._hasActions ||
      this.collapsible ||
      this.movable :
      this._hasActions;

    return html`
      ${showHeader
        ? html`
          <header
            class="header"
            part="header"
            @pointerdown=${this.#onHeaderPointerDown}
          >
            ${chrome && this.collapsible
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
            ${chrome && this.icon !== ""
              ? html`
                <jolly-icon
                  class="icon"
                  part="icon"
                  name=${this.icon}
                  aria-hidden="true"
                ></jolly-icon>
              `
              : nothing}
            ${chrome
              ? html`<span class="title" part="title">${this.heading}</span>`
              : nothing}
            <span class="actions" part="actions">
              <slot name="actions" @slotchange=${this.#onActionsChange}></slot>
            </span>
            ${chrome && this.movable
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
          @jolly-toggle=${this.#folders.onFolderToggle}
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

  releaseMoveHandle(): void {
    this._grabbed = false;
  }

  async focusMoveHandle(
    grabbed: boolean
  ): Promise<void> {
    this._grabbed = grabbed;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLButtonElement>(".grip")?.focus();
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

    let bottom = this._header?.getBoundingClientRect().bottom ?? rect.top;
    for (const child of children) {
      bottom = Math.max(bottom, contentBottom(child));
    }

    return Math.min(bottom - rect.top, rect.height);
  }

  #toggleCollapsed = () => {
    this.collapsed = !this.collapsed;
    this.#state.writeBoolean("collapsed", this.collapsed);

    emitContainerEvent(
      this,
      "jolly-toggle",
      { open: !this.collapsed }
    );
  };

  #restoreCollapsed(): void {
    const stored = this.#state.readBoolean("collapsed");
    if (stored !== null) {
      this.collapsed = stored;
    }
  }

  #onHeaderPointerDown = (
    event: PointerEvent
  ) => {
    if (
      event.button !== 0 ||
      !this.movable ||
      this.grouped ||
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

    const command = grabbedMoveCommand(event);
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
    return pageNamespace(
      this.storageKey,
      "jolly-pane",
      this.heading || "untitled"
    );
  }
}

export function grabbedMoveCommand(
  event: KeyboardEvent
): PaneMoveCommand | undefined {
  return event.shiftKey ?
    kJoinCommands[event.key] :
    kGrabbedCommands[event.key];
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

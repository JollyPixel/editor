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
    paneStyles
  ];

  @property({ type: String })
  declare heading: string;

  @property({ type: String, reflect: true })
  declare key: string;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  /**
   * Opts the pane into folding to its header, like a folder one level up.
   */
  @property({ type: Boolean, reflect: true })
  declare collapsible: boolean;

  @property({ type: Boolean, reflect: true })
  declare collapsed: boolean;

  /**
   * Fills the leftover space of an aligned dock. Ignored elsewhere.
   */
  @property({ type: Boolean, reflect: true })
  declare grow: boolean;

  /**
   * Dims the pane in place while a drag previews where it would land.
   */
  @property({ type: Boolean, reflect: true })
  declare dragging: boolean;

  /**
   * Pins the pane where it is: no grip, no header drag, no keyboard move.
   *
   * A layout normally makes every pane it owns movable. Locking is how an
   * author keeps the fixed furniture of an editor in place while still letting
   * other panes be dragged in and out around it.
   */
  @property({ type: Boolean, reflect: true })
  declare locked: boolean;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  @state()
  declare _hasActions: boolean;

  @state()
  declare _announcement: string;

  /**
   * True inside a layout or a floating window, unless the pane is `locked`.
   *
   * Derived, not authored, and reflected so the header can show a move cursor.
   * Only a pane with a container above it derives anything: one standing on its
   * own keeps whatever it was given, which is what lets a detached clone carry
   * the grip its source was dragged by.
   */
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
  /** True inside a container that can move the pane, lock or no lock. */
  #hosted = false;
  #folders = new FolderListController(this, {
    content: () => this._content,
    contentSlot: () => this._contentSlot,
    namespace: () => this.#namespace(),
    reorderable: () => this.reorderable,
    storage: () => this.storage,
    announce: (message) => this.announce(message)
  });

  /**
   * Identity used by the layout snapshot, falling back to tag and title.
   */
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
    this._hasActions = false;
    this._announcement = "";
    this.movable = false;
    this._grabbed = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
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

  /**
   * Speaks a message through the pane's live region.
   */
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

  /**
   * Header rect, used by a drag session for the ghost size.
   */
  headerRect(): DOMRect {
    return (
      this._header ?? this
    ).getBoundingClientRect();
  }

  /**
   * Extent the pane's own content asks for along an axis, capped by its box.
   *
   * A dock without `align` stretches its panes, so a pane holding two rows can
   * own six hundred pixels of dock, all but forty of them empty. A drop
   * resolved against that box has to clear a midpoint hundreds of pixels below
   * anything the pane draws, and the line marking the end of the dock lands at
   * the bottom of the container rather than under the last thing in it. Read
   * this instead and the empty tail belongs to the dock, which is where it
   * looks like it belongs.
   *
   * Only the block axis packs content, so it is the only one with an extent to
   * measure: across it a pane is simply as wide as it is given.
   *
   * The slotted children are what gets measured, not `scrollHeight`, which
   * never reports below the box it is asked about and so reads a stretched
   * pane as full whatever is in it. A pane slotted nothing at all keeps its
   * box, since there is then nothing to say it occupies any less.
   */
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

    // Folded content measures nothing, and reordered children are not in
    // document order, so the header is the floor and every child is asked.
    let bottom = this._header?.getBoundingClientRect().bottom ?? rect.top;
    for (const child of children) {
      bottom = Math.max(
        bottom,
        child.getBoundingClientRect().bottom
      );
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

  /**
   * Asks whichever container owns movement to run the session.
   *
   * A layout answers with dock targets; a standalone floating window answers
   * with a move-only session. Nothing answers for a plain docked pane, which
   * is then simply not draggable.
   */
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

/**
 * Keeps a header drag from starting on a control the header also carries.
 */
export function isPane(
  element: Element
): element is PaneElement {
  return element.tagName === "JOLLY-PANE";
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

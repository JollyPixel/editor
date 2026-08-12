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
import type { Folder } from "./Folder.ts";
import { paneStyles } from "./Pane.styles.ts";
import {
  detailOf,
  isSlotElement
} from "../dom.ts";

// Registers the chevron and grip glyphs.
import "../icon/Icon.ts";
import { headerGhost } from "../interaction/dragGhost.ts";
import {
  startDragSession,
  verticalInsertionLine,
  type DragSessionHandle
} from "../interaction/DragSession.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  deriveKey,
  resolveOrder
} from "../storage/keys.ts";

// CONSTANTS
const kInteractive = "button, input, select, textarea, a";
const kFolderZone = "folders";

interface FolderReorderDetail {
  folder: Folder;
  command: "cancel" | "down" | "finish" | "start" | "up";
}

interface FolderDragDetail {
  folder: Folder;
  event: PointerEvent;
}

export type PaneMoveCommand =
  | "cancel"
  | "down"
  | "finish"
  | "next"
  | "previous"
  | "start"
  | "up";

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
  declare title: string;

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

  #folders: Folder[] = [];
  #startOrder: string[] | null = null;
  #managed = false;
  /** True inside a container that can move the pane, lock or no lock. */
  #hosted = false;
  #session: DragSessionHandle | null = null;

  /**
   * Identity used by the layout snapshot, falling back to tag and title.
   */
  get layoutKey(): string {
    return this.key === "" ?
      deriveKey("jolly-pane", this.title) :
      this.key;
  }

  constructor() {
    super();

    this.title = "";
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
    if (this.#hosted && changed.has("locked")) {
      this.movable = !this.locked;
    }
  }

  override disconnectedCallback(): void {
    this.#session?.cancel();
    this.#session = null;
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    const showHeader = this.title !== "" ||
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
                  aria-label=${`Fold ${this.title || "pane"}`}
                  @click=${this.#toggleCollapsed}
                ><jolly-icon
                  class="chevron"
                  name="chevron"
                  aria-hidden="true"
                ></jolly-icon></button>
              `
              : nothing}
            <span class="title" part="title">${this.title}</span>
            <span class="actions" part="actions">
              <slot name="actions" @slotchange=${this.#onActionsChange}></slot>
            </span>
            ${this.movable
              ? html`
                <button
                  class="grip"
                  type="button"
                  aria-label=${`Move ${this.title || "pane"}`}
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
          @slotchange=${this.#onContentChange}
          @jolly-folder-reorder=${this.#onReorderCommand}
          @jolly-folder-drag=${this.#onFolderDrag}
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
    if (this.#managed) {
      emitContainerEvent(this, "jolly-layout-dirty", {});
    }
    else {
      this.storage.set(
        `${this.#namespace()}:collapsed`,
        String(this.collapsed)
      );
    }

    emitContainerEvent(
      this,
      "jolly-toggle",
      { open: !this.collapsed }
    );
  };

  #restoreCollapsed(): void {
    const stored = this.storage.get(
      `${this.#namespace()}:collapsed`
    );

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

  #onContentChange = () => {
    this.#folders = this._contentSlot.assignedElements({ flatten: true })
      .filter((element): element is Folder => element.tagName === "JOLLY-FOLDER");

    const keys = this.#folderKeys();
    const namespace = this.#namespace();
    for (let index = 0; index < this.#folders.length; index++) {
      const folder = this.#folders[index];
      folder.reorderable = this.reorderable;
      if (folder.storageKey === "") {
        folder.storage = this.storage;
        folder.persistenceKey = `${namespace}:folder:${keys[index]}`;
      }
    }

    const stored = parseOrder(
      this.storage.get(`${namespace}:order`)
    );
    this.#applyOrder(
      resolveOrder(stored, keys)
    );
  };

  /**
   * Runs the pointer half of a folder reorder.
   *
   * Nothing moves until release: the session paints an insertion line and
   * reports one index, which is what stops a folder oscillating under a hand
   * resting on a boundary.
   */
  #onFolderDrag = (
    event: Event
  ) => {
    if (!this.reorderable) {
      return;
    }

    event.stopPropagation();
    const detail = detailOf<FolderDragDetail>(event);
    if (detail === null || this.#session !== null) {
      return;
    }

    const ordered = this.#orderedFolders();
    const from = ordered.indexOf(detail.folder);
    if (from === -1) {
      return;
    }

    const bounds = rectOf(this._content ?? this);
    const candidates = ordered.map((folder) => {
      const rect = folder.getBoundingClientRect();

      return {
        start: rect.y,
        size: rect.height
      };
    });

    this.#session = startDragSession({
      source: detail.folder,
      event: detail.event,
      handle: detail.event.currentTarget instanceof HTMLElement ?
        detail.event.currentTarget :
        detail.folder,
      ghostLabel: detail.folder.label,
      ghostElement: () => {
        const ghost = headerGhost(detail.folder);
        // Only "label" needs putting back: it is the one thing the header
        // shows that a clone of the attributes alone does not carry.
        ghost.label = detail.folder.label;

        return ghost;
      },
      zones: () => [
        {
          id: kFolderZone,
          rect: bounds,
          candidates,
          axis: "y",
          line: (index) => verticalInsertionLine(bounds, candidates, index)
        }
      ],
      onStart: () => {
        detail.folder.dragging = true;
      },
      onCommit: (result) => {
        if (result.zone === null) {
          return;
        }

        this.#moveFolder(
          from,
          result.index
        );
      },
      onEnd: () => {
        this.#session = null;
        detail.folder.dragging = false;
      }
    });
  };

  #moveFolder(
    from: number,
    index: number
  ): void {
    const keys = this.#orderedKeys();
    const to = index > from ? index - 1 : index;
    if (to === from || to < 0 || to >= keys.length) {
      return;
    }

    const [key] = keys.splice(from, 1);
    keys.splice(to, 0, key);
    this.#applyOrder(keys);
    this.#commitOrder();
    this._announcement =
      `${this.#folders[from]?.label ?? "Folder"}, position ` +
      `${to + 1} of ${keys.length}`;
  }

  #onReorderCommand = (
    event: Event
  ) => {
    if (!this.reorderable) {
      return;
    }

    event.stopPropagation();
    const detail = detailOf<FolderReorderDetail>(event);
    if (detail === null) {
      return;
    }

    const keys = this.#orderedKeys();
    const key = detail.folder.persistenceKey
      .split(":folder:")
      .at(-1);
    if (key === undefined) {
      return;
    }

    if (detail.command === "start") {
      this.#startOrder = keys;
      this._announcement = `${detail.folder.label} grabbed`;

      return;
    }
    if (detail.command === "cancel") {
      if (this.#startOrder !== null) {
        this.#applyOrder(this.#startOrder);
      }
      this.#startOrder = null;
      this._announcement = `${detail.folder.label} movement cancelled`;

      return;
    }
    if (detail.command === "finish") {
      this.#commitOrder();
      this.#startOrder = null;
      this._announcement = `${detail.folder.label} dropped`;

      return;
    }

    const index = keys.indexOf(key);
    const offset = detail.command === "up" ? -1 : 1;
    const next = Math.min(
      Math.max(index + offset, 0),
      keys.length - 1
    );
    if (index === -1 || index === next) {
      return;
    }

    [keys[index], keys[next]] = [keys[next], keys[index]];
    this.#applyOrder(keys);
    this._announcement = `${detail.folder.label}, position ${next + 1} of ${keys.length}`;
  };

  #folderKeys(): string[] {
    const occurrences = new Map<string, number>();

    return this.#folders.map((folder) => {
      if (folder.key !== "") {
        return folder.key;
      }

      const base = deriveKey(
        "jolly-folder",
        folder.label
      );
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);

      return deriveKey(
        "jolly-folder",
        folder.label,
        occurrence
      );
    });
  }

  #orderedFolders(): Folder[] {
    return [...this.#folders].sort(
      (left, right) => Number(left.style.order) - Number(right.style.order)
    );
  }

  #orderedKeys(): string[] {
    return this.#orderedFolders().map(
      (folder) => folder.persistenceKey.split(":folder:").at(-1) ?? ""
    );
  }

  #applyOrder(
    order: readonly string[]
  ): void {
    const positions = new Map(
      order.map((key, index) => [key, index])
    );
    for (const folder of this.#folders) {
      const key = folder.persistenceKey
        .split(":folder:")
        .at(-1) ?? "";
      folder.style.order = String(
        positions.get(key) ?? order.length
      );
    }
  }

  #commitOrder(): void {
    const order = this.#orderedKeys();
    this.storage.set(
      `${this.#namespace()}:order`,
      JSON.stringify(order)
    );
    emitContainerEvent(
      this,
      "jolly-reorder",
      { keys: order }
    );
  }

  #namespace(): string {
    if (this.storageKey !== "") {
      return this.storageKey;
    }

    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-pane:${this.title || "untitled"}`;
  }
}

function rectOf(
  element: Element
) {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

/**
 * Keeps a header drag from starting on a control the header also carries.
 */
function isInteractiveTarget(
  event: PointerEvent
): boolean {
  const { target } = event;

  return target instanceof Element &&
    target.closest(kInteractive) !== null;
}

function parseOrder(
  value: string | null
): string[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) && parsed.every((key) => typeof key === "string")
      ? parsed
      : [];
  }
  catch {
    return [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-pane": PaneElement;
  }
}

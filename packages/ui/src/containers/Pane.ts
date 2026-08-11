// Import Third-party Dependencies
import {
  LitElement,
  html,
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
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import {
  deriveKey,
  resolveOrder
} from "../storage/keys.ts";

interface FolderReorderDetail {
  folder: Folder;
  command: "cancel" | "down" | "finish" | "pointer" | "start" | "up";
  clientY?: number;
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
  declare title: string;

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

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

  @query("slot:not([name])")
  declare _contentSlot: HTMLSlotElement;

  #folders: Folder[] = [];
  #startOrder: string[] | null = null;

  constructor() {
    super();

    this.title = "";
    this.reorderable = false;
    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
    this._hasActions = false;
    this._announcement = "";
  }

  override render(): TemplateResult {
    const showHeader = this.title !== "" || this._hasActions;

    return html`
      ${showHeader
        ? html`
          <header class="header" part="header">
            <span class="title" part="title">${this.title}</span>
            <span class="actions" part="actions">
              <slot name="actions" @slotchange=${this.#onActionsChange}></slot>
            </span>
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
        ></slot>
      </div>
      <span class="live-region" aria-live="polite">${this._announcement}</span>
    `;
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

    const stored = parseOrder(this.storage.get(`${namespace}:order`));
    this.#applyOrder(resolveOrder(stored, keys));
  };

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
    const key = detail.folder.persistenceKey.split(":folder:").at(-1);
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

    if (detail.command === "pointer") {
      const clientY = detail.clientY ?? 0;
      const target = [...this.#folders]
        .sort((left, right) => Number(left.style.order) - Number(right.style.order))
        .find((folder) => clientY < folder.getBoundingClientRect().top +
        (folder.getBoundingClientRect().height / 2));
      const targetKey = target?.persistenceKey.split(":folder:").at(-1);
      const next = targetKey === undefined ? keys.length - 1 : keys.indexOf(targetKey);
      const index = keys.indexOf(key);
      if (index !== -1 && next !== -1 && index !== next) {
        keys.splice(index, 1);
        keys.splice(next, 0, key);
        this.#applyOrder(keys);
        this._announcement = `${detail.folder.label}, position ${next + 1} of ${keys.length}`;
      }

      return;
    }

    const index = keys.indexOf(key);
    const offset = detail.command === "up" ? -1 : 1;
    const next = Math.min(Math.max(index + offset, 0), keys.length - 1);
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

  #orderedKeys(): string[] {
    return [...this.#folders]
      .sort((left, right) => Number(left.style.order) - Number(right.style.order))
      .map((folder) => folder.persistenceKey.split(":folder:").at(-1) ?? "");
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

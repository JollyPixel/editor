// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { RangeChangedEvent } from "@lit-labs/virtualizer/events.js";
import {
  virtualizerRef,
  type VirtualizerHostElement
} from "@lit-labs/virtualizer/virtualize.js";

export interface TreeFocusOptions {
  virtual(): boolean;
  rowsElement(): VirtualizerHostElement | null;
  rowElement(id: string): HTMLElement | null;
  rowIndex(id: string): number;
  activeId(): string | null;
  renaming(): boolean;
}

export class TreeFocusController implements ReactiveController {
  #host: ReactiveControllerHost;
  #options: TreeFocusOptions;
  #range = {
    first: 0,
    last: -1
  };
  #pendingFocusId: string | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: TreeFocusOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  hostUpdated(): void {
    this.#syncRowsTabIndex();
  }

  focusRow(
    id: string
  ): void {
    this.#pendingFocusId = id;
    void this.#host.updateComplete.then(() => {
      if (this.#pendingFocusId !== id) {
        return;
      }
      if (this.#focusPendingRow() || !this.#scrollTo(id)) {
        this.#pendingFocusId = null;
      }
    });
  }

  reveal(
    id: string
  ): void {
    void this.#host.updateComplete.then(() => {
      if (this.#options.rowElement(id) === null) {
        this.#scrollTo(id);
      }
    });
  }

  #scrollTo(
    id: string
  ): boolean {
    const virtualizer = this.#options.virtual() ?
      this.#options.rowsElement()?.[virtualizerRef] :
      undefined;
    const index = this.#options.rowIndex(id);
    if (virtualizer === undefined || index === -1) {
      return false;
    }
    if (index < this.#range.first || index > this.#range.last) {
      virtualizer.element(index)?.scrollIntoView({ block: "nearest" });
    }

    return true;
  }

  focusRenameField(): void {
    const rows = this.#options.rowsElement();
    const field = rows?.querySelector<HTMLInputElement>(".rename") ?? null;
    const root = rows?.getRootNode();
    if (
      field !== null &&
      !(root instanceof ShadowRoot && root.activeElement === field)
    ) {
      field.focus();
    }
  }

  readonly onRangeChanged = (
    event: RangeChangedEvent
  ): void => {
    this.#range = {
      first: event.first,
      last: event.last
    };
    void Promise.resolve().then(() => this.#afterRangeRender());
  };

  #afterRangeRender(): void {
    if (this.#pendingFocusId !== null) {
      this.#focusPendingRow();
      this.#pendingFocusId = null;
    }
    if (this.#options.renaming()) {
      this.focusRenameField();
    }
    this.#syncRowsTabIndex();
  }

  readonly onRowsFocus = (
    event: FocusEvent
  ): void => {
    const rows = event.currentTarget;
    const activeId = this.#options.activeId();
    if (
      event.target === rows &&
      rows instanceof HTMLElement &&
      rows.matches(":focus-visible") &&
      activeId !== null
    ) {
      this.focusRow(activeId);
    }
  };

  #focusPendingRow(): boolean {
    const id = this.#pendingFocusId;
    const row = id === null ? null : this.#options.rowElement(id);
    row?.focus();

    return row !== null;
  }

  #syncRowsTabIndex(): void {
    const rows = this.#options.rowsElement();
    if (rows === null) {
      return;
    }

    const activeId = this.#options.activeId();
    if (
      this.#options.virtual() &&
      activeId !== null &&
      this.#options.rowElement(activeId) === null
    ) {
      rows.tabIndex = 0;
    }
    else {
      rows.removeAttribute("tabindex");
    }
  }
}

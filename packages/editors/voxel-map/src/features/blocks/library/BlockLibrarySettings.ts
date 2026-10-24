// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  nothing
} from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { PopoverController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import type { BlockLibraryOption } from "./BlockLibraryOption.ts";
import { BlockLibraryOrder } from "./BlockLibraryOrder.ts";
import { BlockLibraryScope } from "./BlockLibraryScope.ts";
import "../blockIcons.ts";
import "../../blocksets/blocksetIcons.ts";

// CONSTANTS
const kChangeEvent = "block-library-settings-change";

export interface BlockLibrarySettingsChangeDetail {
  order: BlockLibraryOrder;
  scope: BlockLibraryScope;
}

@customElement("block-library-settings")
export class BlockLibrarySettings extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }

    .trigger {
      --jolly-icon-button-size: calc(var(--jolly-folder-action-size, 20px) + 14px);
      --jolly-control-height: var(--jolly-folder-action-size, 20px);
      --jolly-icon-tone-rest: 100%;
      --jolly-text: var(--jolly-folder-action-fg, var(--jolly-text));
      --jolly-control-bg: var(--jolly-folder-action-bg, var(--jolly-control-bg));
      --jolly-control-bg-hover: var(--jolly-folder-action-bg-hover);
      --jolly-control-bg-focus: var(--jolly-folder-action-bg-focus);
      --jolly-control-bg-active: var(--jolly-folder-action-bg-active);
    }

    .trigger .caret {
      width: 8px;
      height: 8px;
      margin-inline-start: -2px;
      transform: rotate(90deg);
      opacity: 0.7;
    }

    .menu {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      border: 0;
      border-radius: 4px;
      background: var(--jolly-surface-raised);
      color: var(--jolly-text);
      box-shadow: var(--jolly-shadow-floating);
      font: inherit;
    }

    .menu::backdrop {
      background: transparent;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      width: 100%;
      height: var(--jolly-control-height, 20px);
      padding: 0 var(--jolly-space-2, 8px);
      border: 0;
      border-radius: var(--jolly-radius-sm, 2px);
      background: transparent;
      color: inherit;
      font: inherit;
      white-space: nowrap;
      text-align: start;
      cursor: pointer;
    }

    .item:hover,
    .item:focus-visible {
      background: var(--jolly-control-bg-hover);
      outline: none;
    }

    .item[aria-checked="true"] {
      color: var(--jolly-accent);
    }

    .item jolly-icon {
      flex: 0 0 auto;
      width: 12px;
      height: 12px;
    }

    .item .check {
      margin-inline-start: auto;
    }

    .item[aria-checked="false"] .check {
      visibility: hidden;
    }

    .group + .group {
      margin-block-start: var(--jolly-space-1, 4px);
      padding-block-start: var(--jolly-space-1, 4px);
      border-block-start: 1px solid var(--jolly-border);
    }

    .heading {
      padding: 2px var(--jolly-space-2, 8px);
      color: var(--jolly-text-muted);
      font-size: 0.85em;
    }

    .hint {
      max-width: 12em;
      overflow: hidden;
      color: var(--jolly-text-muted);
      text-overflow: ellipsis;
    }
  `;

  @property({ attribute: false })
  declare order: BlockLibraryOrder;

  @property({ attribute: false })
  declare scope: BlockLibraryScope;

  @property({ attribute: false })
  declare activeBlockset: string | null;

  @query(".trigger")
  declare private _trigger: HTMLElement | null;

  @query(".menu")
  declare private _menu: HTMLElement | null;

  #openedByPress = false;
  #pressedWhileOpen = false;

  #popup = new PopoverController(this, {
    anchor: () => this._trigger,
    popover: () => this._menu,
    side: "below",
    align: "start",
    openOnHover: {
      delay: 200
    },
    closeOnHoverLeave: {
      delay: 200
    },
    onOpen: () => {
      if (this.#openedByPress) {
        this.#focusActiveItem();
      }
    },
    onClose: () => {
      this.#openedByPress = false;
    }
  });

  constructor() {
    super();
    this.order = BlockLibraryOrder.Registry;
    this.scope = BlockLibraryScope.All;
    this.activeBlockset = null;
  }

  get open(): boolean {
    return this.#popup.open;
  }

  show(): void {
    this.#popup.show();
  }

  hide(): void {
    this.#popup.hide();
  }

  override render() {
    return html`
      <jolly-button
        class="trigger"
        icon="library-settings"
        icon-only
        label="Library settings"
        title="Library settings"
        aria-haspopup="menu"
        aria-expanded=${String(this.#popup.open)}
        @pointerenter=${this.#popup.onPointerEnter}
        @pointerleave=${this.#popup.onPointerLeave}
        @pointerdown=${this.#onTriggerPointerDown}
        @click=${this.#onTriggerClick}
      >
        <jolly-icon class="caret" name="chevron" aria-hidden="true"></jolly-icon>
      </jolly-button>
      <div
        class="menu"
        popover="auto"
        role="menu"
        aria-label="Block library settings"
        @pointerenter=${this.#popup.onPointerEnter}
        @pointerleave=${this.#popup.onPointerLeave}
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
        @keydown=${this.#onMenuKeyDown}
      >
        ${this.#renderGroup(
          "Order",
          BlockLibraryOrder.all,
          this.order,
          (order) => this.#select({ order, scope: this.scope }),
          () => null
        )}
        ${this.#renderGroup(
          "Show",
          BlockLibraryScope.all,
          this.scope,
          (scope) => this.#select({ order: this.order, scope }),
          (scope) => (
            scope === BlockLibraryScope.Active ? this.activeBlockset : null
          )
        )}
      </div>
    `;
  }

  #renderGroup<TOption extends BlockLibraryOption>(
    heading: string,
    options: readonly TOption[],
    checked: TOption,
    select: (option: TOption) => void,
    hint: (option: TOption) => string | null
  ) {
    return html`
      <div class="group" role="group" aria-label=${heading}>
        <div class="heading" aria-hidden="true">${heading}</div>
        ${options.map((option) => html`
          <button
            type="button"
            class="item"
            role="menuitemradio"
            data-value=${option.value}
            aria-checked=${String(option === checked)}
            @click=${() => select(option)}
          >
            <jolly-icon name=${option.icon} aria-hidden="true"></jolly-icon>
            <span>${option.label}</span>
            ${this.#renderHint(hint(option))}
            <jolly-icon class="check" name="check" aria-hidden="true"></jolly-icon>
          </button>
        `)}
      </div>
    `;
  }

  #renderHint(
    hint: string | null
  ) {
    if (hint === null) {
      return nothing;
    }

    return html`<span class="hint">${hint}</span>`;
  }

  #onTriggerPointerDown(): void {
    this.#pressedWhileOpen = this.#popup.open && this.#openedByPress;
  }

  #onTriggerClick(): void {
    if (this.#pressedWhileOpen) {
      this.#pressedWhileOpen = false;

      return;
    }

    this.#openedByPress = true;
    if (this._menu?.matches(":popover-open")) {
      this.#focusActiveItem();

      return;
    }

    this.show();
  }

  #focusActiveItem(): void {
    this._menu
      ?.querySelector<HTMLButtonElement>("[aria-checked='true']")
      ?.focus();
  }

  #onMenuKeyDown(
    event: KeyboardEvent
  ): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const items = [
      ...this._menu?.querySelectorAll<HTMLButtonElement>(".item") ?? []
    ];
    const index = items.findIndex(
      (item) => item === this.shadowRoot?.activeElement
    );
    const step = event.key === "ArrowDown" ? 1 : -1;
    items.at((index + step) % items.length)?.focus();
    event.preventDefault();
  }

  #select(
    detail: BlockLibrarySettingsChangeDetail
  ): void {
    this.hide();
    if (detail.order === this.order && detail.scope === this.scope) {
      return;
    }

    this.order = detail.order;
    this.scope = detail.scope;
    this.dispatchEvent(
      new CustomEvent<BlockLibrarySettingsChangeDetail>(kChangeEvent, {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-library-settings": BlockLibrarySettings;
  }
}

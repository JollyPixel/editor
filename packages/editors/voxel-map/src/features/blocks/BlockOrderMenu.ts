// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { PopoverController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  BLOCK_LIBRARY_ORDERS,
  DEFAULT_BLOCK_LIBRARY_ORDER,
  type BlockLibraryOrder
} from "./blockLibraryOrder.ts";
import { choiceOf } from "../../shared/toolChoice.ts";

export interface BlockOrderChangeDetail {
  order: BlockLibraryOrder;
}

@customElement("block-order-menu")
export class BlockOrderMenu extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
    }

    .trigger {
      --jolly-icon-button-size: calc(var(--jolly-control-height, 20px) + 12px);
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
  `;

  @property({ type: String })
  declare value: BlockLibraryOrder;

  @query(".trigger")
  declare private _trigger: HTMLElement | null;

  @query(".menu")
  declare private _menu: HTMLElement | null;

  #openOnPress = false;

  #popup = new PopoverController(this, {
    anchor: () => this._trigger,
    popover: () => this._menu,
    side: "below",
    align: "start",
    onOpen: () => {
      this._menu
        ?.querySelector<HTMLButtonElement>("[aria-checked='true']")
        ?.focus();
    }
  });

  constructor() {
    super();
    this.value = DEFAULT_BLOCK_LIBRARY_ORDER;
  }

  get open(): boolean {
    return this.#popup.open;
  }

  show(): void {
    this._menu?.showPopover();
  }

  hide(): void {
    this.#popup.hide();
  }

  override render() {
    const { active } = choiceOf(BLOCK_LIBRARY_ORDERS, this.value);

    return html`
      <jolly-button
        class="trigger"
        icon=${active.icon}
        icon-only
        label=${`Order: ${active.label}`}
        title=${`Order: ${active.label}`}
        aria-haspopup="menu"
        aria-expanded=${String(this.#popup.open)}
        @pointerdown=${this.#onTriggerPointerDown}
        @click=${this.#onTriggerClick}
      >
        <jolly-icon class="caret" name="chevron" aria-hidden="true"></jolly-icon>
      </jolly-button>
      <div
        class="menu"
        popover="auto"
        role="menu"
        aria-label="Block order"
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
        @keydown=${this.#onMenuKeyDown}
      >
        ${BLOCK_LIBRARY_ORDERS.map((option) => html`
          <button
            type="button"
            class="item"
            role="menuitemradio"
            data-value=${option.value}
            aria-checked=${String(option.value === active.value)}
            @click=${() => this.#select(option.value)}
          >
            <jolly-icon name=${option.icon} aria-hidden="true"></jolly-icon>
            <span>${option.label}</span>
            <jolly-icon class="check" name="check" aria-hidden="true"></jolly-icon>
          </button>
        `)}
      </div>
    `;
  }

  #onTriggerPointerDown(): void {
    this.#openOnPress = this.#popup.open;
  }

  #onTriggerClick(): void {
    if (this.#openOnPress) {
      this.#openOnPress = false;

      return;
    }

    this.show();
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
    order: BlockLibraryOrder
  ): void {
    this.hide();
    if (order === this.value) {
      return;
    }

    this.value = order;
    this.dispatchEvent(
      new CustomEvent<BlockOrderChangeDetail>("block-order-change", {
        detail: { order },
        bubbles: true,
        composed: true
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-order-menu": BlockOrderMenu;
  }
}

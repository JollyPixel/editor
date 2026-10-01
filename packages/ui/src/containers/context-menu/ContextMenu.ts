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
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { contextMenuStyles } from "./ContextMenu.styles.ts";
import { contextMenuKeyAction } from "./contextMenuKeys.ts";
import { emitContainerEvent } from "../events.ts";
import { deepActiveElement } from "../../dom.ts";
import { PopoverController } from "../../field/PopoverController.ts";
import type { AnchorRect } from "../../geometry/anchoredPosition.ts";
import "../../icon/Icon.ts";
import type { IconName } from "../../icon/registry.ts";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  intent?: "danger";
}

export type ContextMenuEntry = ContextMenuItem | "separator";

@customElement("jolly-context-menu")
export class ContextMenu extends LitElement {
  static override styles = contextMenuStyles;

  @property({ attribute: false })
  declare items: readonly ContextMenuEntry[];

  @property({ type: String })
  declare label: string;

  @query(".menu")
  declare _menu: HTMLElement;

  #point: AnchorRect = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  };
  #invoker: HTMLElement | null = null;
  #chosen: string | null = null;
  #pressed = false;
  #showOnRelease = false;

  #popup = new PopoverController(this, {
    anchor: () => this.#point,
    popover: () => this._menu,
    gap: 0,
    onClose: () => this.#settle()
  });

  constructor() {
    super();
    this.items = [];
    this.label = "";
  }

  get open(): boolean {
    return this.#popup.open;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("pointerdown", this.#onPointerDown, true);
    window.addEventListener("pointerup", this.#onPointerUp, true);
    window.addEventListener("pointercancel", this.#onPointerUp, true);
  }

  override disconnectedCallback(): void {
    window.removeEventListener("pointerdown", this.#onPointerDown, true);
    window.removeEventListener("pointerup", this.#onPointerUp, true);
    window.removeEventListener("pointercancel", this.#onPointerUp, true);
    this.#pressed = false;
    this.#showOnRelease = false;
    super.disconnectedCallback();
  }

  openAt(
    x: number,
    y: number
  ): void {
    this.#point = {
      top: y,
      bottom: y,
      left: x,
      right: x
    };
    this.#chosen = null;
    this.performUpdate();
    if (this._menu.matches(":popover-open")) {
      this.#popup.reposition();
      this.#focusFirst();

      return;
    }
    // Linux fires contextmenu on press: the release would light-dismiss it.
    if (this.#pressed) {
      this.#showOnRelease = true;

      return;
    }

    this.#show();
  }

  close(): void {
    this.#showOnRelease = false;
    this.#popup.hide();
  }

  #show(): void {
    this.#invoker = deepActiveElement();
    this.#popup.show();
    this.#focusFirst();
  }

  readonly #onPointerDown = (): void => {
    this.#pressed = true;
  };

  readonly #onPointerUp = (): void => {
    this.#pressed = false;
    if (!this.#showOnRelease) {
      return;
    }

    this.#showOnRelease = false;
    if (!this._menu.matches(":popover-open")) {
      this.#show();
    }
  };

  override render(): TemplateResult {
    const withIcons = this.items.some(
      (entry) => entry !== "separator" && entry.icon !== undefined
    );

    return html`
      <div
        class="menu overlay-motion"
        popover
        role="menu"
        aria-label=${this.label === "" ? nothing : this.label}
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
        @keydown=${this.#onKeyDown}
      >
        ${this.items.map((entry) => (entry === "separator" ?
          html`<div class="separator" role="separator"></div>` :
          this.#renderItem(entry, withIcons)))}
      </div>
    `;
  }

  #renderItem(
    item: ContextMenuItem,
    withIcons: boolean
  ): TemplateResult {
    return html`
      <button
        class=${item.intent === "danger" ? "item danger" : "item"}
        type="button"
        role="menuitem"
        tabindex="-1"
        ?disabled=${item.disabled === true}
        @click=${() => this.#choose(item.id)}
        @pointermove=${focusCurrentTarget}
      >
        ${withIcons ?
          html`<jolly-icon
            class="icon"
            name=${item.icon ?? nothing}
            aria-hidden="true"
          ></jolly-icon>` :
          nothing}
        <span class="label">${item.label}</span>
      </button>
    `;
  }

  #buttons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>(".item")];
  }

  #focusFirst(): void {
    this.#buttons().find((button) => !button.disabled)?.focus();
  }

  #choose(
    id: string
  ): void {
    this.#chosen = id;
    this.close();
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const buttons = this.#buttons();
    const path = event.composedPath();
    const action = contextMenuKeyAction(
      event.key,
      buttons.map((button) => !button.disabled),
      buttons.findIndex((button) => path.includes(button))
    );

    switch (action.kind) {
      case "focus":
        event.preventDefault();
        buttons[action.index].focus();
        break;
      case "activate":
        event.preventDefault();
        buttons[action.index].click();
        break;
      case "close":
        event.preventDefault();
        this.close();
        break;
      default:
        break;
    }
  };

  #settle(): void {
    const invoker = this.#invoker;
    const chosen = this.#chosen;
    this.#invoker = null;
    this.#chosen = null;

    const active = deepActiveElement();
    if (
      invoker?.isConnected === true &&
      (
        active === null ||
        active === this.ownerDocument.body ||
        this.renderRoot.contains(active)
      )
    ) {
      invoker.focus();
    }
    if (chosen !== null) {
      emitContainerEvent(this, "jolly-context-action", { id: chosen });
    }
  }
}

function focusCurrentTarget(
  event: PointerEvent
): void {
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-context-menu": ContextMenu;
  }
}

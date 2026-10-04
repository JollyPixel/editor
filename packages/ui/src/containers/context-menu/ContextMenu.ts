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
import {
  SubmenuController,
  levelItems
} from "./SubmenuController.ts";
import { emitContainerEvent } from "../events.ts";
import { deepActiveElement } from "../../dom.ts";
import { PopoverController } from "../../field/PopoverController.ts";
import type { AnchorRect } from "../../geometry/anchoredPosition.ts";
import "../../icon/Icon.ts";
import type { IconName } from "../../icon/registry.ts";
import { revealOverflowTitle } from "../../interaction/overflowTitle.ts";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  intent?: "danger";
  items?: readonly ContextMenuEntry[];
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
    onClose: () => this.#settle(),
    onReposition: () => this.#submenus.reposition()
  });

  #submenus = new SubmenuController(this, {
    root: () => this._menu
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
    window.addEventListener(
      "pointerdown",
      this.#onPointerDown,
      true
    );
    window.addEventListener(
      "pointerup",
      this.#onPointerUp,
      true
    );
    window.addEventListener(
      "pointercancel",
      this.#onPointerUp,
      true
    );
  }

  override disconnectedCallback(): void {
    window.removeEventListener(
      "pointerdown",
      this.#onPointerDown,
      true
    );
    window.removeEventListener(
      "pointerup",
      this.#onPointerUp,
      true
    );
    window.removeEventListener(
      "pointercancel",
      this.#onPointerUp,
      true
    );
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
    this.#submenus.closeAll();
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
        ${this.#renderEntries(this.items, "")}
      </div>
    `;
  }

  #renderEntries(
    entries: readonly ContextMenuEntry[],
    path: string
  ): TemplateResult[] {
    const withIcons = entries.some(
      (entry) => entry !== "separator" && entry.icon !== undefined
    );

    return entries.map((entry, index) => {
      if (entry === "separator") {
        return html`<div class="separator" role="separator"></div>`;
      }

      return entry.items === undefined ?
        this.#renderItem(entry, withIcons) :
        this.#renderBranch(entry, entry.items, withIcons, `${path}${index}`);
    });
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
        @pointerenter=${this.#onItemEnter}
        @pointermove=${focusCurrentTarget}
      >
        ${this.#renderContent(item, withIcons)}
      </button>
    `;
  }

  #renderBranch(
    item: ContextMenuItem,
    entries: readonly ContextMenuEntry[],
    withIcons: boolean,
    key: string
  ): TemplateResult {
    const empty = entries.every((entry) => entry === "separator");

    return html`
      <div class="branch" role="none">
        <button
          class="item"
          type="button"
          role="menuitem"
          tabindex="-1"
          aria-haspopup="menu"
          aria-expanded=${this.#submenus.expanded(key) ? "true" : "false"}
          data-submenu=${key}
          ?disabled=${item.disabled === true || empty}
          @click=${this.#onBranchClick}
          @pointerenter=${this.#onItemEnter}
          @pointermove=${focusCurrentTarget}
        >
          ${this.#renderContent(item, withIcons)}
          <jolly-icon
            class="chevron"
            name="chevron"
            aria-hidden="true"
          ></jolly-icon>
        </button>
        <div
          class="menu overlay-motion"
          popover
          role="menu"
          aria-label=${item.label}
          @beforetoggle=${this.#submenus.onBeforeToggle}
          @toggle=${this.#submenus.onToggle}
          @pointerenter=${this.#submenus.cancelHover}
        >
          ${this.#renderEntries(entries, `${key}/`)}
        </div>
      </div>
    `;
  }

  #renderContent(
    item: ContextMenuItem,
    withIcons: boolean
  ): TemplateResult {
    return html`
      ${withIcons ?
        html`<jolly-icon
          class="icon"
          name=${item.icon ?? nothing}
          aria-hidden="true"
        ></jolly-icon>` :
        nothing}
      <span
        class="label"
        @pointerenter=${revealOverflowTitle}
      >${item.label}</span>
    `;
  }

  #focusFirst(): void {
    levelItems(this._menu).find(
      (button) => !button.disabled
    )?.focus();
  }

  readonly #onItemEnter = (
    event: PointerEvent
  ): void => {
    if (event.currentTarget instanceof HTMLButtonElement) {
      this.#submenus.hover(event.currentTarget);
    }
  };

  readonly #onBranchClick = (
    event: MouseEvent
  ): void => {
    if (event.currentTarget instanceof HTMLButtonElement) {
      this.#submenus.open(event.currentTarget, false);
    }
  };

  #choose(
    id: string
  ): void {
    this.#chosen = id;
    this.close();
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const path = event.composedPath();
    const menu = path.find((target) => target instanceof HTMLElement &&
      target.classList.contains("menu"));
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    const buttons = levelItems(menu);
    const action = contextMenuKeyAction(
      event.key,
      buttons.map((button) => {
        return {
          enabled: !button.disabled,
          submenu: button.dataset.submenu !== undefined
        };
      }),
      buttons.findIndex((button) => path.includes(button)),
      menu !== this._menu
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
      case "open":
        event.preventDefault();
        this.#submenus.open(buttons[action.index], true);
        break;
      case "back":
        event.preventDefault();
        this.#submenus.back(menu);
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
    this.#submenus.closeAll();
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
      emitContainerEvent(
        this,
        "jolly-context-action",
        { id: chosen }
      );
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

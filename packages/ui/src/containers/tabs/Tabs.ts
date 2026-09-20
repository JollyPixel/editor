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
import type { Tab } from "./Tab.ts";
import { tabsStyles } from "./Tabs.styles.ts";
import { nextEnabledIndex } from "../../controls/roving.ts";
import { isButtonElement } from "../../dom.ts";
import "../../icon/Icon.ts";

// CONSTANTS
let kTabsId = 0;

export type TabsOrientation = "horizontal" | "vertical";

export type TabsVariant = "default" | "skew";

@customElement("jolly-tabs")
export class Tabs extends LitElement {
  static override styles = [
    tabsStyles
  ];

  @property({ type: String })
  declare value: string;

  @property({ type: String, reflect: true })
  declare orientation: TabsOrientation;

  @property({ type: String, reflect: true })
  declare variant: TabsVariant;

  @state()
  declare _tabs: Tab[];

  @query("slot:not([name])")
  declare _slot: HTMLSlotElement;

  #generatedId: string;

  constructor() {
    super();

    this.value = "";
    this.orientation = "horizontal";
    this.variant = "default";
    this._tabs = [];
    this.#generatedId = `jolly-tabs-${++kTabsId}`;
  }

  override render(): TemplateResult {
    return html`
      <div class="strip" part="strip">
        <div
          class="list"
          part="list"
          role="tablist"
          aria-orientation=${this.orientation}
          @keydown=${this.#onKeyDown}
        >
          ${this._tabs.map((tab, index) => this.#renderItem(tab, index))}
        </div>
        <slot name="list-end"></slot>
      </div>
      <div class="panels">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
    `;
  }

  #renderItem(
    tab: Tab,
    index: number
  ): TemplateResult {
    const selected = tab.value === this.value;

    return html`
      <div
        class="item"
        part=${selected ? "tab tab-selected" : "tab"}
        ?data-closable=${tab.closable}
        ?data-action=${tab.action !== ""}
        ?data-disabled=${tab.disabled}
        ?data-selected=${selected}
      >
        <button
          id=${this.#buttonId(index)}
          class="label"
          type="button"
          role="tab"
          aria-controls=${this.#panelId(index)}
          aria-selected=${String(selected)}
          tabindex=${selected ? "0" : "-1"}
          ?disabled=${tab.disabled}
          title=${tab.tooltip || nothing}
          data-index=${index}
          @click=${this.#onSelect}
          @mousedown=${this.#onMouseDown}
          @auxclick=${this.#onAuxClick}
        ><span class="text">${tab.label}</span>${tab.badge === "" ?
          nothing :
          html`<span class="badge" part="badge">${tab.badge}</span>`
        }</button>
        ${tab.action === "" ? nothing : html`
          <button
            class="action"
            part=${selected ? "action action-selected" : "action"}
            type="button"
            tabindex="-1"
            aria-label=${`${tab.actionLabel || tab.action} ${tab.label}`}
            title=${tab.actionLabel || nothing}
            data-index=${index}
            @click=${this.#onActionClick}
          ><jolly-icon name=${tab.action} aria-hidden="true"></jolly-icon></button>
        `}
        ${tab.closable ? html`
          <button
            class="close"
            part=${selected ? "close close-selected" : "close"}
            type="button"
            tabindex="-1"
            aria-label=${`Close ${tab.label}`}
            ?disabled=${tab.disabled}
            data-index=${index}
            @click=${this.#onCloseClick}
          ><jolly-icon name="close" aria-hidden="true"></jolly-icon></button>
        ` : nothing}
      </div>
    `;
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    this.#refreshTabs();
    if (changed.has("value") || changed.has("_tabs")) {
      this.value = this.#resolveValue();
    }
  }

  protected override updated(): void {
    this.#synchroniseTabs();
  }

  #onSlotChange = () => {
    this.#refreshTabs();
  };

  #refreshTabs(): void {
    const slot = this._slot;
    if (!slot) {
      return;
    }

    const tabs = slot.assignedElements({ flatten: true })
      .filter((element): element is Tab => element.tagName === "JOLLY-TAB");
    const unchanged = tabs.length === this._tabs.length &&
      tabs.every((tab, index) => tab === this._tabs[index]);
    if (unchanged) {
      return;
    }

    this._tabs = tabs;
  }

  #resolveValue(): string {
    if (this._tabs.length === 0) {
      return this.value;
    }

    const requested = this._tabs.find(
      (tab) => tab.value === this.value && !tab.disabled
    );
    const selected = requested ?? this._tabs.find(
      (tab) => !tab.disabled
    );

    return selected?.value ?? "";
  }

  #synchroniseTabs(): void {
    for (let index = 0; index < this._tabs.length; index++) {
      const tab = this._tabs[index];
      tab.active = tab.value === this.value && !tab.disabled;
      tab.id = this.#panelId(index);
      tab.setAttribute(
        "aria-labelledby",
        this.#buttonId(index)
      );
    }
  }

  #onSelect = (
    event: MouseEvent
  ) => {
    if (!isButtonElement(event.currentTarget)) {
      return;
    }

    const index = Number(
      event.currentTarget.dataset.index
    );
    this.#selectIndex(index, true);
  };

  #onMouseDown = (
    event: MouseEvent
  ) => {
    if (event.button === 1 && this.#closableIndex(event) !== -1) {
      event.preventDefault();
    }
  };

  #onAuxClick = (
    event: MouseEvent
  ) => {
    if (event.button !== 1) {
      return;
    }

    const index = this.#closableIndex(event);
    if (index !== -1) {
      event.preventDefault();
      this.#requestClose(index);
    }
  };

  #onCloseClick = (
    event: MouseEvent
  ) => {
    event.stopPropagation();
    const index = this.#closableIndex(event);
    if (index !== -1) {
      this.#requestClose(index);
    }
  };

  #onActionClick = (
    event: MouseEvent
  ) => {
    event.stopPropagation();
    if (!isButtonElement(event.currentTarget)) {
      return;
    }

    const tab = this._tabs[Number(event.currentTarget.dataset.index)];
    if (tab !== undefined && tab.action !== "") {
      emitContainerEvent(
        this,
        "jolly-tab-action",
        { value: tab.value }
      );
    }
  };

  #closableIndex(
    event: MouseEvent
  ): number {
    if (!isButtonElement(event.currentTarget)) {
      return -1;
    }

    const index = Number(event.currentTarget.dataset.index);
    const tab = this._tabs[index];

    return tab !== undefined && tab.closable && !tab.disabled ? index : -1;
  }

  #requestClose(
    index: number
  ): void {
    emitContainerEvent(
      this,
      "jolly-tab-close",
      { value: this._tabs[index].value }
    );
  }

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    const current = this._tabs.findIndex(
      (tab) => tab.value === this.value
    );
    const enabled = this._tabs.map((tab) => !tab.disabled);
    let next = -1;
    if (event.key === "Home") {
      next = enabled.indexOf(true);
    }
    else if (event.key === "End") {
      next = enabled.lastIndexOf(true);
    }
    else {
      const backward = this.orientation === "horizontal" ?
        "ArrowLeft" :
        "ArrowUp";
      const forward = this.orientation === "horizontal" ?
        "ArrowRight" :
        "ArrowDown";
      if (event.key === backward) {
        next = nextEnabledIndex(enabled, current, -1);
      }
      else if (event.key === forward) {
        next = nextEnabledIndex(enabled, current, 1);
      }
    }
    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#selectIndex(next, true);
    void this.updateComplete.then(() => {
      this.renderRoot.querySelectorAll<HTMLButtonElement>(
        "[role=tab]"
      )[next]?.focus();
    });
  };

  #selectIndex(
    index: number,
    userChange: boolean
  ): void {
    const tab = this._tabs[index];
    if (tab === undefined || tab.disabled) {
      return;
    }

    this.value = tab.value;
    if (userChange) {
      emitContainerEvent(
        this,
        "jolly-tab-change",
        { value: tab.value }
      );
    }
  }

  #buttonId(
    index: number
  ): string {
    return `${this.id || this.#generatedId}-tab-${index}`;
  }

  #panelId(
    index: number
  ): string {
    return `${this.id || this.#generatedId}-panel-${index}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tabs": Tabs;
  }
}

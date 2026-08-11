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
import type { Tab } from "./Tab.ts";
import { tabsStyles } from "./Tabs.styles.ts";
import { nextEnabledIndex } from "../controls/roving.ts";
import { isButtonElement } from "../dom.ts";

// CONSTANTS
let kTabsId = 0;

export type TabsOrientation = "horizontal" | "vertical";

@customElement("jolly-tabs")
export class Tabs extends LitElement {
  static override styles = [
    tabsStyles
  ];

  @property({ type: String })
  declare value: string;

  @property({ type: String, reflect: true })
  declare orientation: TabsOrientation;

  @state()
  declare _tabs: Tab[];

  @query("slot")
  declare _slot: HTMLSlotElement;

  #generatedId = `jolly-tabs-${++kTabsId}`;

  constructor() {
    super();

    this.value = "";
    this.orientation = "horizontal";
    this._tabs = [];
  }

  override render(): TemplateResult {
    return html`
      <div
        class="list"
        role="tablist"
        aria-orientation=${this.orientation}
        @keydown=${this.#onKeyDown}
      >
        ${this._tabs.map((tab, index) => html`
          <button
            id=${this.#buttonId(index)}
            type="button"
            role="tab"
            aria-controls=${this.#panelId(index)}
            aria-selected=${String(tab.value === this.value)}
            tabindex=${tab.value === this.value ? "0" : "-1"}
            ?disabled=${tab.disabled}
            data-index=${index}
            @click=${this.#onSelect}
          >${tab.label}</button>
        `)}
      </div>
      <div class="panels">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
    `;
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (changed.has("value")) {
      this.#synchroniseSelection(false);
    }
  }

  #onSlotChange = () => {
    this._tabs = this._slot.assignedElements({ flatten: true })
      .filter((element): element is Tab => element.tagName === "JOLLY-TAB");
    this.#synchroniseSelection(false);
  };

  #synchroniseSelection(
    userChange: boolean
  ): void {
    const requested = this._tabs.find(
      (tab) => tab.value === this.value && !tab.disabled
    );
    const selected = requested ?? this._tabs.find((tab) => !tab.disabled);
    const nextValue = selected?.value ?? "";
    if (this.value !== nextValue) {
      this.value = nextValue;
    }

    for (let index = 0; index < this._tabs.length; index++) {
      const tab = this._tabs[index];
      tab.active = tab === selected;
      tab.id = this.#panelId(index);
      tab.setAttribute(
        "aria-labelledby",
        this.#buttonId(index)
      );
    }
    if (userChange && selected !== undefined) {
      emitContainerEvent(
        this,
        "jolly-change",
        { value: selected.value }
      );
    }
  }

  #onSelect = (
    event: MouseEvent
  ) => {
    if (!isButtonElement(event.currentTarget)) {
      return;
    }

    const index = Number(event.currentTarget.dataset.index);
    this.#selectIndex(index, true);
  };

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
    this.#synchroniseSelection(userChange);
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

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
import {
  tabDropTarget,
  tabSegment
} from "./tabReorder.ts";
import { nextEnabledIndex } from "../../controls/roving.ts";
import { isButtonElement } from "../../dom.ts";
import type { Rect } from "../../geometry/Rect.ts";
import {
  horizontalInsertionLine,
  startDragSession,
  verticalInsertionLine,
  type DragSessionHandle
} from "../../interaction/drag/DragSession.ts";
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

  @property({ type: Boolean, reflect: true })
  declare reorderable: boolean;

  @state()
  declare _tabs: Tab[];

  @state()
  declare _dragging: Tab | null;

  @query("slot:not([name])")
  declare _slot: HTMLSlotElement;

  @query(".list")
  declare _list: HTMLElement | null;

  #generatedId: string;
  #session: DragSessionHandle | null = null;

  constructor() {
    super();

    this.value = "";
    this.orientation = "horizontal";
    this.variant = "default";
    this.reorderable = false;
    this._tabs = [];
    this._dragging = null;
    this.#generatedId = `jolly-tabs-${++kTabsId}`;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#session?.cancel();
    this.#session = null;
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
    const icon = tab.icon === "" ?
      nothing :
      html`<jolly-icon class="icon" name=${tab.icon} aria-hidden="true"></jolly-icon>`;
    const text = tab.iconOnly ?
      nothing :
      html`<span class="text">${tab.label}</span>`;

    return html`
      <div
        class="item"
        part=${selected ? "tab tab-selected" : "tab"}
        ?data-closable=${tab.closable}
        ?data-action=${tab.action !== ""}
        ?data-disabled=${tab.disabled}
        ?data-selected=${selected}
        ?data-fixed=${tab.fixed}
        ?data-dragging=${tab === this._dragging}
      >
        <button
          id=${this.#buttonId(index)}
          class="label"
          type="button"
          role="tab"
          aria-controls=${this.#panelId(index)}
          aria-selected=${String(selected)}
          aria-label=${tab.iconOnly ? tab.label : nothing}
          tabindex=${selected ? "0" : "-1"}
          ?disabled=${tab.disabled}
          title=${tab.tooltip || (tab.iconOnly ? tab.label : nothing)}
          data-index=${index}
          @click=${this.#onSelect}
          @mousedown=${this.#onMouseDown}
          @auxclick=${this.#onAuxClick}
          @pointerdown=${this.#onPointerDown}
        >${icon}${text}${tab.badge === "" ?
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

  #onPointerDown = (
    event: PointerEvent
  ) => {
    if (
      !this.reorderable ||
      event.button !== 0 ||
      this.#session !== null ||
      !isButtonElement(event.currentTarget)
    ) {
      return;
    }

    const from = Number(event.currentTarget.dataset.index);
    const tab = this._tabs[from];
    const segment = tabSegment(
      this._tabs.map((candidate) => candidate.fixed),
      from
    );
    const items = [
      ...this.renderRoot.querySelectorAll<HTMLElement>(".item")
    ];
    const list = this._list;
    if (
      tab === undefined ||
      tab.disabled ||
      segment === null ||
      segment.end - segment.start < 2 ||
      list === null
    ) {
      return;
    }

    const axis = this.orientation === "horizontal" ? "x" : "y";
    const rects = items.slice(segment.start, segment.end)
      .map((item) => item.getBoundingClientRect());
    const candidates = rects.map((rect) => (axis === "x" ?
      { start: rect.x, size: rect.width } :
      { start: rect.y, size: rect.height }));
    const bounds = unionOf(rects);
    const insertionLine = axis === "x" ?
      horizontalInsertionLine :
      verticalInsertionLine;

    this.#session = startDragSession({
      source: items[from],
      event,
      handle: event.currentTarget,
      ghostLabel: tab.label,
      zones: () => [{
        id: this.#generatedId,
        rect: rectOf(list),
        candidates,
        axis,
        source: from - segment.start,
        line: (index) => insertionLine(bounds, candidates, index)
      }],
      onStart: () => {
        this._dragging = tab;
      },
      onCommit: (result) => {
        const index = result.zone === null ?
          null :
          tabDropTarget(segment, from, result.index);
        if (index !== null) {
          emitContainerEvent(
            this,
            "jolly-tab-reorder",
            {
              value: tab.value,
              index
            }
          );
        }
      },
      onEnd: () => {
        this.#session = null;
        this._dragging = null;
      }
    });
  };

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

function rectOf(
  element: Element
): Rect {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function unionOf(
  rects: readonly DOMRect[]
): Rect {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tabs": Tabs;
  }
}

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
import { repeat } from "lit/directives/repeat.js";

// Import Internal Dependencies
import { emitContainerEvent } from "../events.ts";
import type {
  Tab,
  TabStatus
} from "./Tab.ts";
import { tabsStyles } from "./Tabs.styles.ts";
import { TabStrip } from "./TabStrip.ts";
import { isButtonElement } from "../../dom.ts";
import { resolveDropIndex } from "../../interaction/drag/dropIndex.ts";
import {
  GRABBING_CLASS,
  ensureGrabbingStyles
} from "../../interaction/drag/grabbing.ts";
import { SlidingReorder } from "../../interaction/drag/SlidingReorder.ts";
import {
  startPointerDragSession,
  type PointerDragSessionHandle
} from "../../interaction/pointer/PointerDragSession.ts";
import { RovingFocus } from "../../interaction/focus/RovingFocus.ts";
import "../../feedback/Spinner.ts";
import "../../icon/Icon.ts";

// CONSTANTS
let kTabsId = 0;
const kModifiedDescription = "Unsaved changes";
const kModifiedMarker = html`<span class="marker modified" part="modified" aria-hidden="true"></span>`;
const kStatusIndicators: Record<TabStatus, TabStatusIndicator | null> = {
  idle: null,
  busy: {
    marker: html`<jolly-spinner class="marker busy" part="busy" aria-hidden="true"></jolly-spinner>`,
    description: "Loading"
  },
  failed: {
    marker: html`
      <jolly-icon class="marker failed" part="failed" name="warning" aria-hidden="true"></jolly-icon>
    `,
    description: "Failed to load"
  }
};
const kDragThreshold = 4;

interface TabStatusIndicator {
  marker: TemplateResult;
  description: string;
}

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

  #generatedId: string;
  #session: PointerDragSessionHandle | null = null;
  #roving = new RovingFocus(this, ".label");

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
          ${repeat(
            this._tabs,
            (tab) => tab,
            (tab, index) => this.#renderItem(tab, index)
          )}
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
    const marker = tabMarker(tab);

    return html`
      <div
        class="item"
        part=${tabParts(selected, tab === this._dragging)}
        ?data-marked=${marker !== nothing}
        ?data-closable=${tab.closable}
        ?data-action=${tab.action !== ""}
        ?data-disabled=${tab.disabled}
        ?data-selected=${selected}
        ?data-fixed=${tab.fixed}
      >
        <button
          id=${this.#buttonId(index)}
          class="label"
          type="button"
          role="tab"
          aria-controls=${this.#panelId(index)}
          aria-selected=${String(selected)}
          aria-label=${tab.iconOnly ? tab.label : nothing}
          aria-description=${tabDescription(tab)}
          aria-busy=${tab.status === "busy" ? "true" : nothing}
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
        }${tab.closable ? nothing : marker}</button>
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
          >${marker}<jolly-icon name="close" aria-hidden="true"></jolly-icon></button>
        ` : nothing}
      </div>
    `;
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    this.#refreshTabs();
    if (changed.has("value") || changed.has("_tabs")) {
      this.value = this.#strip().active(this.value);
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

    this.#session?.cancel();
    this._tabs = tabs;
  }

  #strip(): TabStrip {
    return new TabStrip(this._tabs.map((tab) => {
      return {
        key: tab.value,
        disabled: tab.disabled,
        fixed: tab.fixed
      };
    }));
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
    const strip = this.#strip();
    const segment = strip.segment(from);
    const items = [
      ...this.renderRoot.querySelectorAll<HTMLElement>(".item")
    ];
    if (
      tab === undefined ||
      tab.disabled ||
      segment === null ||
      segment.end - segment.start < 2
    ) {
      return;
    }

    const axis = this.orientation === "horizontal" ? "x" : "y";
    let reorder: SlidingReorder | null = null;
    let current: number | null = null;

    ensureGrabbingStyles();
    this.#session = startPointerDragSession({
      element: event.currentTarget,
      event,
      threshold: kDragThreshold,
      documentClass: GRABBING_CLASS,
      suppressClick: true,
      onStart: () => {
        reorder = new SlidingReorder({
          items: items.slice(segment.start, segment.end),
          from: from - segment.start,
          axis,
          pointer: axis === "x" ? event.clientX : event.clientY
        });
        this._dragging = tab;
      },
      onMove: (clientX, clientY) => {
        if (reorder === null) {
          return;
        }

        current = resolveDropIndex({
          position: axis === "x" ? clientX : clientY,
          candidates: reorder.candidates,
          current
        });
        reorder.preview(current, clientX, clientY);
      },
      onFinish: (settlement) => {
        this.#session = null;
        if (reorder === null) {
          return;
        }

        const index = settlement === "commit" && current !== null ?
          strip.dropTarget(from, current) :
          null;
        void reorder.settle(() => {
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
        }).then((owned) => {
          if (owned) {
            this._dragging = null;
          }
        });
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
    const next = this.#strip().navigate(
      event.key,
      current,
      this.orientation
    );
    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#selectIndex(next, true);
    this.#roving.focus(next);
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

function tabParts(
  selected: boolean,
  dragging: boolean
): string {
  const parts = ["tab"];
  if (selected) {
    parts.push("tab-selected");
  }
  if (dragging) {
    parts.push("tab-dragging");
  }

  return parts.join(" ");
}

function tabMarker(
  tab: Tab
): TemplateResult | typeof nothing {
  return kStatusIndicators[tab.status]?.marker ??
    (tab.modified ? kModifiedMarker : nothing);
}

function tabDescription(
  tab: Tab
): string | typeof nothing {
  const descriptions = [
    kStatusIndicators[tab.status]?.description,
    tab.modified ? kModifiedDescription : undefined
  ].filter((description) => description !== undefined);

  return descriptions.length === 0 ? nothing : descriptions.join(", ");
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-tabs": Tabs;
  }
}

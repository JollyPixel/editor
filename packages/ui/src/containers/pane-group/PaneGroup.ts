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
import {
  grabbedMoveCommand,
  isPane,
  type PaneElement,
  type PaneMoveCommand
} from "../pane/Pane.ts";
import { paneGroupStyles } from "./PaneGroup.styles.ts";
import {
  resolveActiveTab,
  tabNavigationTarget
} from "./tabSelection.ts";
import {
  naturalTabsWidth,
  tabLabelsFit,
  type TabExtent
} from "./tabCompaction.ts";
import { revealOverflowTitle } from "../../interaction/overflowTitle.ts";
import type { Rect } from "../../geometry/Rect.ts";
import { horizontalInsertionLine } from "../../interaction/drag/DragSession.ts";
import type { DropCandidate } from "../../interaction/drag/dropIndex.ts";
import { hiddenStyles } from "../../theme/styles/hiddenStyles.ts";

@customElement("jolly-pane-group")
export class PaneGroup extends LitElement {
  static override styles = [
    paneGroupStyles,
    hiddenStyles
  ];

  @property({ type: String, reflect: true })
  declare active: string;

  @state()
  declare _panes: PaneElement[];

  @state()
  declare _grabbed: boolean;

  @state()
  declare _dragging: string;

  @state()
  declare _compact: boolean;

  @query(".tabs")
  declare _tabs: HTMLElement;

  @query("slot")
  declare _slot: HTMLSlotElement;

  #managed = false;
  #resizeObserver = new ResizeObserver(() => this.#fitTabs());

  constructor() {
    super();

    this.active = "";
    this._panes = [];
    this._grabbed = false;
    this._dragging = "";
    this._compact = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
    this.#resizeObserver.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  override render(): TemplateResult {
    const areaTone = this._panes
      .find((pane) => pane.layoutKey === this.active)
      ?.areaTone ?? null;

    return html`
      <div
        class="tabs"
        part="tabs"
        role="tablist"
        style=${areaTone === null ? nothing : `--jolly-pane-header-bg: var(--jolly-tone-${areaTone}-fill)`}
        @keydown=${this.#onKeyDown}
      >
        ${this._panes.map((pane, index) => {
          const selected = pane.layoutKey === this.active;
          const heading = pane.heading || pane.layoutKey;
          const iconOnly = this._compact && pane.icon !== "";

          return html`
            <button
              class="tab"
              part=${selected ? "tab tab-selected" : "tab"}
              type="button"
              role="tab"
              data-index=${index}
              data-key=${pane.layoutKey}
              aria-selected=${String(selected)}
              ?disabled=${pane.disabled}
              tabindex=${selected ? "0" : "-1"}
              ?data-grabbed=${selected && this._grabbed}
              ?data-dragging=${pane.layoutKey === this._dragging}
              ?data-icon-only=${iconOnly}
              title=${iconOnly ? heading : nothing}
              @click=${this.#onSelect}
              @pointerdown=${this.#onTabPointerDown}
            >${this.#renderTabIcon(pane)}<span
              class="label"
              part="tab-label"
              @pointerenter=${iconOnly ? nothing : revealOverflowTitle}
            >${heading}</span></button>
          `;
        })}
      </div>
      <div class="panels" part="panels">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
    `;
  }

  protected override willUpdate(): void {
    this.active = this.#resolveActive();
  }

  protected override updated(
    changed: Map<PropertyKey, unknown>
  ): void {
    this.#fitTabs();
    for (const pane of this._panes) {
      if (pane.parentElement === this) {
        pane.inactive = pane.layoutKey !== this.active;
      }
    }
    if (changed.has("active") || changed.has("_panes")) {
      this.closest("jolly-dock")?.refreshAreaTones?.();
    }
  }

  panes(): PaneElement[] {
    if (!this.hasUpdated) {
      return [...this.children].filter(isPane);
    }

    return this._slot.assignedElements({ flatten: true }).filter(isPane);
  }

  activePane(): PaneElement | null {
    return this.panes().find((pane) => pane.layoutKey === this.active) ??
      null;
  }

  occupiedSize(
    axis: "x" | "y"
  ): number {
    const rect = this.getBoundingClientRect();

    return axis === "y" ? rect.height : rect.width;
  }

  tabsRect(): Rect {
    const rect = (this._tabs ?? this).getBoundingClientRect();

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }

  tabCandidates(): DropCandidate[] {
    return this.#tabButtons().map((button) => {
      const rect = button.getBoundingClientRect();

      return {
        start: rect.x,
        size: rect.width
      };
    });
  }

  tabLine(
    index: number
  ): Rect {
    return horizontalInsertionLine(
      this.tabsRect(),
      this.tabCandidates(),
      index
    );
  }

  markDragging(
    pane: string
  ): void {
    this._dragging = pane;
  }

  releaseMoveHandle(): void {
    this._grabbed = false;
  }

  async focusMoveHandle(
    pane: string,
    grabbed: boolean
  ): Promise<void> {
    this._panes = this.panes();
    this.active = pane;
    this._grabbed = grabbed;
    await this.updateComplete;
    this.#tabButtons()
      .find((button) => button.dataset.key === pane)
      ?.focus();
  }

  #renderTabIcon(
    pane: PaneElement
  ): TemplateResult | typeof nothing {
    if (pane.icon === "") {
      return nothing;
    }

    return html`
      <jolly-icon
        part="tab-icon"
        name=${pane.icon}
        on-fill
        aria-hidden="true"
      ></jolly-icon>
    `;
  }

  #fitTabs(): void {
    const tabs = this._tabs;
    if (!tabs) {
      return;
    }

    const buttons = this.#tabButtons();
    const compactButtons = buttons.filter(
      (button) => button.hasAttribute("data-icon-only")
    );
    for (const button of compactButtons) {
      button.removeAttribute("data-icon-only");
    }
    let naturalWidth: number;
    try {
      naturalWidth = naturalTabsWidth(
        buttons.map(tabExtentOf),
        columnGapOf(tabs)
      );
    }
    finally {
      for (const button of compactButtons) {
        button.setAttribute("data-icon-only", "");
      }
    }
    this._compact = !tabLabelsFit(naturalWidth, tabs.clientWidth);
  }

  #tabButtons(): HTMLButtonElement[] {
    return [
      ...this.renderRoot.querySelectorAll<HTMLButtonElement>(".tab")
    ];
  }

  #resolveActive(): string {
    return resolveActiveTab(this.panes(), this.active);
  }

  #onSlotChange = () => {
    this._panes = this.panes();
  };

  #onSelect = (
    event: MouseEvent
  ) => {
    if (event.currentTarget instanceof HTMLButtonElement) {
      this.#selectIndex(Number(event.currentTarget.dataset.index));
    }
  };

  #onTabPointerDown = (
    event: PointerEvent
  ) => {
    const button = event.currentTarget;
    if (event.button !== 0 || !(button instanceof HTMLButtonElement)) {
      return;
    }

    const pane = this._panes[Number(button.dataset.index)];
    if (pane === undefined || !pane.movable) {
      return;
    }

    event.preventDefault();
    emitContainerEvent(this, "jolly-pane-drag", {
      pane,
      event,
      handle: button
    });
  };

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    const current = this._panes.findIndex(
      (pane) => pane.layoutKey === this.active
    );
    const pane = this._panes[current];
    if (pane === undefined) {
      return;
    }

    if (event.key === " ") {
      if (!pane.movable) {
        return;
      }

      event.preventDefault();
      this._grabbed = !this._grabbed;
      this.#emitMove(pane, this._grabbed ? "start" : "finish");

      return;
    }

    if (this._grabbed) {
      const command = grabbedMoveCommand(event);
      if (command === undefined) {
        return;
      }

      event.preventDefault();
      if (command === "cancel") {
        this._grabbed = false;
      }
      this.#emitMove(pane, command);

      return;
    }

    const next = tabNavigationTarget(this._panes, event.key, current);
    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#selectIndex(next);
    void this.updateComplete.then(() => {
      this.#tabButtons()[next]?.focus();
    });
  };

  #selectIndex(
    index: number
  ): void {
    const pane = this._panes[index];
    if (
      pane === undefined ||
      pane.disabled ||
      pane.layoutKey === this.active
    ) {
      return;
    }

    this.active = pane.layoutKey;
    emitContainerEvent(this, "jolly-tab-change", {
      value: pane.layoutKey
    });
    if (this.#managed) {
      emitContainerEvent(this, "jolly-layout-dirty", {
        type: "group",
        pane: pane.layoutKey
      });
    }
  }

  #emitMove(
    pane: PaneElement,
    command: PaneMoveCommand
  ): void {
    emitContainerEvent(this, "jolly-pane-move", {
      pane,
      command
    });
  }
}

function tabExtentOf(
  tab: HTMLButtonElement
): TabExtent {
  const label = tab.querySelector(".label");

  return {
    tabWidth: tab.getBoundingClientRect().width,
    labelWidth: label?.clientWidth ?? 0,
    labelContentWidth: label?.scrollWidth ?? 0,
    labelHidden: tab.hasAttribute("data-icon-only"),
    innerGap: columnGapOf(tab)
  };
}

function columnGapOf(
  element: Element
): number {
  return Number.parseFloat(getComputedStyle(element).columnGap) || 0;
}

export function isPaneGroup(
  element: Element
): element is PaneGroup {
  return element.tagName === "JOLLY-PANE-GROUP";
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-pane-group": PaneGroup;
  }
}

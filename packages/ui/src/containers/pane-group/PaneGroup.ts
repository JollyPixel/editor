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

  @query(".tabs")
  declare _tabs: HTMLElement;

  @query("slot")
  declare _slot: HTMLSlotElement;

  #managed = false;

  constructor() {
    super();

    this.active = "";
    this._panes = [];
    this._grabbed = false;
    this._dragging = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#managed = this.closest("jolly-dock-layout") !== null;
  }

  override render(): TemplateResult {
    return html`
      <div
        class="tabs"
        part="tabs"
        role="tablist"
        @keydown=${this.#onKeyDown}
      >
        ${this._panes.map((pane, index) => {
          const selected = pane.layoutKey === this.active;

          return html`
            <button
              class="tab"
              part=${selected ? "tab tab-selected" : "tab"}
              type="button"
              role="tab"
              data-index=${index}
              data-key=${pane.layoutKey}
              aria-selected=${String(selected)}
              tabindex=${selected ? "0" : "-1"}
              ?data-grabbed=${selected && this._grabbed}
              ?data-dragging=${pane.layoutKey === this._dragging}
              @click=${this.#onSelect}
              @pointerdown=${this.#onTabPointerDown}
            >${this.#renderTabIcon(pane)}<span class="label" part="tab-label"
              >${pane.heading || pane.layoutKey}</span></button>
          `;
        })}
      </div>
      <div class="panels" part="panels">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
    `;
  }

  protected override willUpdate(
    changed: Map<PropertyKey, unknown>
  ): void {
    if (changed.has("active") || changed.has("_panes")) {
      this.active = this.#resolveActive();
    }
  }

  protected override updated(): void {
    for (const pane of this._panes) {
      if (pane.parentElement === this) {
        pane.inactive = pane.layoutKey !== this.active;
      }
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
        aria-hidden="true"
      ></jolly-icon>
    `;
  }

  #tabButtons(): HTMLButtonElement[] {
    return [
      ...this.renderRoot.querySelectorAll<HTMLButtonElement>(".tab")
    ];
  }

  #resolveActive(): string {
    if (this._panes.length === 0) {
      return this.active;
    }

    const requested = this._panes.find(
      (pane) => pane.layoutKey === this.active
    );

    return (requested ?? this._panes[0]).layoutKey;
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

    const next = this.#navigationTarget(event.key, current);
    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#selectIndex(next);
    void this.updateComplete.then(() => {
      this.#tabButtons()[next]?.focus();
    });
  };

  #navigationTarget(
    key: string,
    current: number
  ): number {
    const last = this._panes.length - 1;
    switch (key) {
      case "Home":
        return 0;
      case "End":
        return last;
      case "ArrowLeft":
        return current <= 0 ? last : current - 1;
      case "ArrowRight":
        return current >= last ? 0 : current + 1;
      default:
        return -1;
    }
  }

  #selectIndex(
    index: number
  ): void {
    const pane = this._panes[index];
    if (pane === undefined || pane.layoutKey === this.active) {
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

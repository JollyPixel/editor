// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { map } from "lit/directives/map.js";

// Import Internal Dependencies
import { PopoverController } from "../field/PopoverController.ts";
import {
  RovingFocus,
  type RovingFocusHost
} from "../interaction/focus/RovingFocus.ts";
import { OptionGrid } from "./OptionGrid.ts";
import { OptionGroups } from "./OptionGroups.ts";

export interface SelectGridOptions<TValue> {
  anchor: () => HTMLElement | null;
  selected: () => number;
  current: () => TValue | undefined;
  editable: () => boolean;
  onInput: (value: TValue) => void;
  onChange: (value: TValue) => void;
}

// CONSTANTS
const kOpenKeys = new Set([
  "ArrowDown",
  "ArrowUp"
]);

export class SelectGrid<TValue> {
  static readonly PopoverId = "options";

  #options: SelectGridOptions<TValue>;
  #roving: RovingFocus;
  #popup: PopoverController;
  #grid = new OptionGrid<TValue>(new OptionGroups([]), 1);
  #previewed = -1;

  constructor(
    host: RovingFocusHost,
    options: SelectGridOptions<TValue>
  ) {
    this.#options = options;
    this.#roving = new RovingFocus(host, ".tile");
    this.#popup = new PopoverController(host, {
      anchor: options.anchor,
      popover: () => host.renderRoot.querySelector<HTMLElement>(".popover"),
      align: "end",
      onOpen: () => {
        const selected = this.#options.selected();
        this.#previewed = selected === -1 ? this.#grid.first : selected;
        this.#roving.focus(this.#previewed);
      },
      onClose: () => {
        this.#revert();
      }
    });
  }

  get open(): boolean {
    return this.#popup.open;
  }

  arrange(
    groups: OptionGroups<TValue>,
    columns: number
  ): void {
    this.#grid = new OptionGrid(groups, columns);
  }

  openFromKey(
    event: KeyboardEvent
  ): void {
    if (kOpenKeys.has(event.key) && !this.#popup.open) {
      event.preventDefault();
      this.#popup.show();
    }
  }

  render(
    label: string
  ): TemplateResult {
    const { groups, columns } = this.#grid;
    const selected = this.#options.selected();
    const focused = groups.options[this.#roving.focused];

    return html`
      <div
        class="popover overlay-motion"
        id=${SelectGrid.PopoverId}
        popover
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        <div
          class="listbox"
          role="listbox"
          aria-label=${label || nothing}
          style=${`--jolly-select-columns: ${columns}`}
          @keydown=${this.#onKeyDown}
          @focusin=${this.#onFocusIn}
          @pointerleave=${this.#onPointerLeave}
        >
          ${map(groups, (group) => html`
            <div
              class="group"
              role="group"
              aria-label=${group.label || nothing}
            >
              ${group.label === "" ?
                nothing :
                html`<span class="group-label" aria-hidden="true">${group.label}</span>`}
              <div class="tiles">
                ${group.indices.map((index) => this.#renderTile(index, selected))}
              </div>
            </div>
          `)}
        </div>
        <div class="caption" aria-hidden="true">${focused?.label ?? ""}</div>
      </div>
    `;
  }

  #renderTile(
    index: number,
    selected: number
  ): TemplateResult {
    const option = this.#grid.groups.options[index];
    const focused = index === this.#roving.focused;

    return html`
      <button
        class="tile"
        type="button"
        role="option"
        data-index=${index}
        tabindex=${focused ? 0 : -1}
        title=${option.label}
        aria-label=${option.label}
        aria-selected=${index === selected ? "true" : "false"}
        ?data-active=${focused}
        ?disabled=${option.disabled === true}
        @pointerenter=${this.#onPointerEnter}
        @click=${this.#onClick}
      >
        ${option.icon === undefined ?
          html`<span class="tile-label">${option.label}</span>` :
          html`<jolly-icon name=${option.icon}></jolly-icon>`}
      </button>
    `;
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const next = this.#grid.move(this.#roving.focused, event.key);
    if (next === -1) {
      return;
    }

    event.preventDefault();
    this.#roving.focus(next);
  };

  readonly #onFocusIn = (
    event: FocusEvent
  ): void => {
    const index = this.#roving.indexAt(event.target);
    if (index === null) {
      return;
    }

    this.#roving.track(event);
    this.#preview(index);
  };

  readonly #onPointerEnter = (
    event: PointerEvent
  ): void => {
    const index = this.#roving.indexAt(event.target);
    if (
      index !== null &&
      index !== this.#roving.focused &&
      this.#grid.groups.options[index]?.disabled !== true
    ) {
      this.#roving.focus(index);
    }
  };

  readonly #onPointerLeave = (): void => {
    const selected = this.#options.selected();
    if (this.#popup.open && selected !== -1) {
      this.#roving.focus(selected);
    }
  };

  readonly #onClick = (
    event: MouseEvent
  ): void => {
    const index = this.#roving.indexAt(event.target);
    const option = index === null ?
      undefined :
      this.#grid.groups.options[index];
    if (option === undefined || option.disabled === true) {
      return;
    }

    if (this.#options.editable()) {
      this.#previewed = -1;
      this.#options.onChange(option.value);
    }
    this.#popup.hide();
  };

  #preview(
    index: number
  ): void {
    const option = this.#grid.groups.options[index];
    if (index === this.#previewed || option === undefined) {
      return;
    }

    this.#previewed = index;
    if (this.#options.editable()) {
      this.#options.onInput(option.value);
    }
  }

  #revert(): void {
    const previewed = this.#previewed;
    const current = this.#options.current();
    this.#previewed = -1;
    if (
      previewed !== -1 &&
      previewed !== this.#options.selected() &&
      current !== undefined &&
      this.#options.editable()
    ) {
      this.#options.onInput(current);
    }
  }
}

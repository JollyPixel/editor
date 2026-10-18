// Import Third-party Dependencies
import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";
import { map } from "lit/directives/map.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { selectStyles } from "./Select.styles.ts";
import { selectGridStyles } from "./SelectGrid.styles.ts";
import { isSelectElement } from "../dom.ts";
import { PointerFocusController } from "../field/PointerFocusController.ts";
import { OptionGroups } from "./OptionGroups.ts";
import { SelectGrid } from "./SelectGrid.ts";
import type { JollyOption } from "./types.ts";

export interface SelectDefaults {
  layout: "list" | "grid";
  columns: number;
}

// CONSTANTS
const kMixedValue = "__jolly_mixed__";
const kMixedLabel = "—";

@customElement("jolly-select")
export class Select<TValue> extends JollyField<TValue> {
  static readonly Defaults: SelectDefaults = {
    layout: "list",
    columns: 4
  };

  static override styles = [
    ...JollyField.styles,
    selectStyles,
    selectGridStyles
  ];

  @property({ attribute: false })
  declare options: JollyOption<TValue>[];

  @property({ type: String, reflect: true })
  declare layout: "list" | "grid";

  @property({ type: Number })
  declare columns: number;

  @query(".trigger")
  declare private _trigger: HTMLButtonElement | null;

  #pointerFocus = new PointerFocusController(this);
  #groups = new OptionGroups<TValue>([]);
  #grid = new SelectGrid<TValue>(this, {
    anchor: () => this._trigger,
    selected: () => this.#selectedIndex,
    current: () => this.concreteValue,
    editable: () => this.editable,
    onInput: (value) => this.emitInput(value),
    onChange: (value) => this.emitChange(value)
  });

  constructor() {
    super();

    this.options = [];
    this.layout = Select.Defaults.layout;
    this.columns = Select.Defaults.columns;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    super.willUpdate(changed);
    if (changed.has("options")) {
      this.#groups = new OptionGroups(this.options);
    }
    if (changed.has("options") || changed.has("columns")) {
      this.#grid.arrange(this.#groups, this.columns);
    }
  }

  protected renderValue(): TemplateResult {
    return this.layout === "grid" ?
      this.#renderGrid() :
      this.#renderList();
  }

  protected override updated(): void {
    const select = this.renderRoot.querySelector("select");
    if (select !== null) {
      select.value = this.#selectedKey;
    }
  }

  #renderList(): TemplateResult {
    return html`
      <span class="select-wrap">
        <select
          ?disabled=${this.disabled}
          ?data-pointer-focus=${this.#pointerFocus.active}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @focus=${this.#pointerFocus.onFocus}
          @blur=${this.#pointerFocus.onBlur}
          @keydown=${this.#pointerFocus.onKeyDown}
          @change=${this.#onChange}
        >
          ${this.mixed ? html`<option value=${kMixedValue}>${kMixedLabel}</option>` : nothing}
          ${map(this.#groups, (group) => (group.label === "" ?
            group.indices.map((index) => this.#renderListOption(index)) :
            html`
              <optgroup label=${group.label}>
                ${group.indices.map((index) => this.#renderListOption(index))}
              </optgroup>
            `))}
        </select>
        <jolly-icon class="chevron" name="chevron"></jolly-icon>
      </span>
    `;
  }

  #renderListOption(
    index: number
  ): TemplateResult {
    const option = this.options[index];

    return html`
      <option value=${String(index)} ?disabled=${option.disabled === true}>
        ${option.label}
      </option>
    `;
  }

  #renderGrid(): TemplateResult {
    const selected = this.options[this.#selectedIndex];

    return html`
      <span class="select-wrap">
        <button
          class="trigger"
          type="button"
          popovertarget=${SelectGrid.PopoverId}
          aria-haspopup="listbox"
          aria-expanded=${this.#grid.open ? "true" : "false"}
          ?disabled=${this.disabled}
          ?data-pointer-focus=${this.#pointerFocus.active}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @focus=${this.#pointerFocus.onFocus}
          @blur=${this.#pointerFocus.onBlur}
          @keydown=${this.#onTriggerKeyDown}
        >
          ${selected?.icon === undefined ?
            nothing :
            html`<jolly-icon class="trigger-icon" name=${selected.icon}></jolly-icon>`}
          <span class="trigger-label">
            ${this.mixed ? kMixedLabel : selected?.label ?? ""}
          </span>
        </button>
        <jolly-icon class="chevron" name="chevron"></jolly-icon>
        ${this.#grid.render(this.label)}
      </span>
    `;
  }

  get #selectedIndex(): number {
    const current = this.concreteValue;
    if (current === undefined) {
      return -1;
    }

    return this.options.findIndex(
      (option) => this.valuesEqual(option.value, current)
    );
  }

  get #selectedKey(): string {
    if (this.concreteValue === undefined) {
      return kMixedValue;
    }

    const index = this.#selectedIndex;

    return index === -1 ? "" : String(index);
  }

  #onChange(
    event: Event
  ): void {
    if (!isSelectElement(event.target)) {
      return;
    }

    if (!this.editable) {
      event.target.value = this.#selectedKey;

      return;
    }

    const option = this.options[
      Number(event.target.value)
    ];
    if (option === undefined) {
      return;
    }

    this.emitChange(option.value);
  }

  #onTriggerKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();
    this.#grid.openFromKey(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-select": Select<unknown>;
  }
}

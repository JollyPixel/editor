// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import type { BlockProperties } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  PropertyRow,
  type PropertyType
} from "./PropertyRow.ts";
import { PropertyRows } from "./PropertyRows.ts";

// CONSTANTS
const kPropertiesChangeEvent = "properties-change";
const kTypeOptions: JollyOption<PropertyType>[] = [
  { label: "Text", value: "string" },
  { label: "Number", value: "number" },
  { label: "Boolean", value: "boolean" }
];

export interface PropertiesChangeDetail {
  properties: BlockProperties;
}

@customElement("custom-properties-editor")
export class CustomPropertiesEditor extends LitElement {
  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--jolly-row-gap, 4px) var(--jolly-space-1, 4px);
    }

    jolly-separator {
      grid-column: 1 / -1;
    }

    .prop-row {
      display: contents;
    }

    .prop-row.draft .value {
      grid-column: 3 / -1;
    }
  `;

  @property({ attribute: false })
  declare properties: Readonly<Record<string, unknown>>;

  @property({ type: Boolean })
  declare disabled: boolean;

  @state()
  private declare _draft: PropertyRow;

  constructor() {
    super();

    this.properties = {};
    this.disabled = false;
    this._draft = new PropertyRow();
  }

  override render() {
    const saved = PropertyRows.from(this.properties);
    const draftIndex = saved.size;

    return html`
      <jolly-separator label="Custom Properties"></jolly-separator>
      ${[...saved, this._draft].map(
        (row, index) => html`
          <div class=${index === draftIndex ? "prop-row draft" : "prop-row"}>
            <jolly-text
              placeholder="key"
              ?disabled=${this.disabled}
              .value=${row.key}
              @jolly-change=${(
                event: CustomEvent<JollyChangeDetail<string>>
              ) => this.#change(index, row.with({ key: event.detail.value }))}
            ></jolly-text>
            <jolly-select
              ?disabled=${this.disabled}
              .options=${kTypeOptions}
              .value=${row.type}
              @jolly-change=${(
                event: CustomEvent<JollyChangeDetail<PropertyType>>
              ) => this.#change(index, row.retype(event.detail.value))}
            ></jolly-select>
            ${this.#renderValue(row, index)}
            ${index === draftIndex ? nothing : html`
              <jolly-button
                icon="close"
                icon-only
                variant="danger"
                label="Remove property"
                ?disabled=${this.disabled}
                @click=${() => this.#change(index, row.with({ key: "" }))}
              ></jolly-button>
            `}
          </div>
        `
      )}
    `;
  }

  #renderValue(
    row: PropertyRow,
    index: number
  ) {
    const { value } = row;
    if (typeof value === "number") {
      return html`
        <jolly-number
          class="value"
          ?disabled=${this.disabled}
          .value=${value}
          @jolly-change=${(
            event: CustomEvent<JollyChangeDetail<number>>
          ) => this.#change(index, row.with({ value: event.detail.value }))}
        ></jolly-number>
      `;
    }
    if (typeof value === "boolean") {
      return html`
        <jolly-checkbox
          class="value"
          ?disabled=${this.disabled}
          .value=${value}
          @jolly-change=${(
            event: CustomEvent<JollyChangeDetail<boolean>>
          ) => this.#change(index, row.with({ value: event.detail.value }))}
        ></jolly-checkbox>
      `;
    }

    return html`
      <jolly-text
        class="value"
        placeholder="value"
        ?disabled=${this.disabled}
        .value=${value}
        @jolly-change=${(
          event: CustomEvent<JollyChangeDetail<string>>
        ) => this.#change(index, row.with({ value: event.detail.value }))}
      ></jolly-text>
    `;
  }

  #change(
    index: number,
    row: PropertyRow
  ): void {
    const saved = PropertyRows.from(this.properties);
    const draft = index === saved.size ? row : this._draft;
    const edited = new PropertyRows([...saved, this._draft].with(index, row));

    this._draft = draft.key.trim() === "" ? draft : new PropertyRow();
    if (!edited.equals(saved)) {
      this.#publish(edited.toProperties());
    }
  }

  #publish(
    properties: BlockProperties
  ): void {
    const event = new CustomEvent<PropertiesChangeDetail>(
      kPropertiesChangeEvent,
      {
        detail: { properties },
        bubbles: true,
        composed: true
      }
    );

    this.dispatchEvent(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "custom-properties-editor": CustomPropertiesEditor;
  }
}

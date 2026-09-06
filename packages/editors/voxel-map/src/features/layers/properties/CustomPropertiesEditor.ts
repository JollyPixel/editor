// Import Third-party Dependencies
import {
  LitElement,
  css,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  PropertyRow,
  PropertyRowsChangeDetail
} from "./propertyDraft.ts";

// CONSTANTS
const kRowsChangeEvent = "property-rows-change";

@customElement("custom-properties-editor")
export class CustomPropertiesEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .prop-row {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    .prop-row jolly-text {
      flex: 1;
      min-width: 0;
    }
  `;

  @property({ attribute: false })
  declare rows: PropertyRow[];
  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  constructor() {
    super();
    this.rows = [];
    this.storageKey = "voxel-map:folder:custom-properties";
  }

  override render() {
    return html`
      <jolly-folder
        key=${this.storageKey}
        label="Custom Properties"
        storage-key=${this.storageKey}
      >
        ${repeat(
          this.rows,
          (_, index) => index,
          (row, index) => html`
            <div class="prop-row">
              <jolly-text
                placeholder="key"
                .value=${row.key}
                @jolly-change=${(
                  event: CustomEvent<JollyChangeDetail<string>>
                ) => this.#change(index, { key: event.detail.value })}
              ></jolly-text>
              <jolly-text
                placeholder="value"
                .value=${row.value}
                @jolly-change=${(
                  event: CustomEvent<JollyChangeDetail<string>>
                ) => this.#change(index, { value: event.detail.value })}
              ></jolly-text>
              <jolly-button
                icon="close"
                icon-only
                variant="danger"
                label="Remove property"
                @click=${() => this.#remove(index)}
              ></jolly-button>
            </div>
          `
        )}
        <jolly-button @click=${this.#add}>+ Add property</jolly-button>
      </jolly-folder>
    `;
  }

  #change(
    index: number,
    patch: Partial<PropertyRow>
  ): void {
    this.#publish(
      this.rows.map((row, candidate) => (
        candidate === index ?
          {
            ...row,
            ...patch
          } :
          row
      ))
    );
  }

  #add(): void {
    this.#publish([
      ...this.rows,
      {
        key: "",
        value: ""
      }
    ]);
  }

  #remove(
    index: number
  ): void {
    this.#publish(
      this.rows.filter((_, candidate) => candidate !== index)
    );
  }

  #publish(
    rows: PropertyRow[]
  ): void {
    this.dispatchEvent(new CustomEvent<PropertyRowsChangeDetail>(
      kRowsChangeEvent,
      {
        detail: { rows },
        bubbles: true,
        composed: true
      }
    ));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "custom-properties-editor": CustomPropertiesEditor;
  }
}

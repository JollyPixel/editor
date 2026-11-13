// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { DEFAULT_SNAPSHOT_POLICY } from "@jolly-pixel/asset-server/client";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/separator";
import type { SnapshotSection } from "@jolly-pixel/server";

// Import Internal Dependencies
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

// CONSTANTS
const kSnapshotLabel = "Snapshots";
const kSnapshotFields: readonly SnapshotField[] = [
  {
    key: "delay",
    label: "Delay (ms)",
    description: "Quiet time after the last edit before an asset is " +
      "written to disk."
  },
  {
    key: "maxDelay",
    label: "Max delay (ms)",
    description: "Longest wait before an asset edited without pause is " +
      "written to disk."
  }
];

interface SnapshotField {
  key: keyof SnapshotSection;
  label: string;
  description: string;
}

@customElement("studio-project-snapshot")
export class ProjectSnapshot extends LitElement {
  static override styles = [settingsStyles, css`
    .fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--jolly-space-3);
    }
  `];

  @property({ attribute: false })
  declare value: SnapshotSection | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.value = null;
    this.disabled = false;
  }

  override render(): TemplateResult | typeof nothing {
    const { value } = this;
    if (value === null) {
      return nothing;
    }

    return html`
      <section aria-label=${kSnapshotLabel}>
        <jolly-separator label=${kSnapshotLabel}></jolly-separator>
        <div class="fields">
          ${kSnapshotFields.map((field) => this.#field(value, field))}
        </div>
      </section>
    `;
  }

  #field(
    value: SnapshotSection,
    field: SnapshotField
  ): TemplateResult {
    const { key } = field;

    return html`
      <jolly-number
        data-field=${`snapshot-${key}`}
        label=${field.label}
        label-position="top"
        description=${field.description}
        description-display="tooltip"
        .min=${0}
        .step=${100}
        .value=${value[key]}
        .default=${DEFAULT_SNAPSHOT_POLICY[key]}
        ?disabled=${this.disabled}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
          this.dispatchEvent(new SettingsEditEvent("snapshot", {
            ...value,
            [key]: event.detail.value
          }));
        }}
      ></jolly-number>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-snapshot": ProjectSnapshot;
  }
}

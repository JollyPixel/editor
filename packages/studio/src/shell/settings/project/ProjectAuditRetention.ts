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
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/separator";
import {
  DEFAULT_AUDIT_SECTION,
  type AuditSection
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

// CONSTANTS
const kRetentionLabel = "Audit retention";
const kKeepForever = 0;
const kRetentionFields: readonly RetentionField[] = [
  {
    key: "keepRowsDays",
    label: "Keep entries (days)",
    description: "Age after which audit entries are deleted. 0 keeps them " +
      "forever."
  },
  {
    key: "keepVersionsDays",
    label: "Keep versions (days)",
    description: "Age after which the versions an edit entry opens are " +
      "deleted; the entry stays. 0 keeps them forever. Named tags are " +
      "never deleted."
  }
];

interface RetentionField {
  key: keyof AuditSection;
  label: string;
  description: string;
}

@customElement("studio-project-audit-retention")
export class ProjectAuditRetention extends LitElement {
  static override styles = [settingsStyles, css`
    .fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--jolly-space-3);
    }
  `];

  @property({ attribute: false })
  declare value: AuditSection | null;

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
      <section aria-label=${kRetentionLabel}>
        <jolly-separator label=${kRetentionLabel}></jolly-separator>
        <div class="fields">
          ${kRetentionFields.map((field) => this.#field(value, field))}
        </div>
      </section>
    `;
  }

  #field(
    value: AuditSection,
    field: RetentionField
  ): TemplateResult {
    const { key } = field;

    return html`
      <jolly-number
        data-field=${`audit-${key}`}
        label=${field.label}
        label-position="top"
        description=${field.description}
        description-display="tooltip"
        .min=${kKeepForever}
        .step=${1}
        .value=${value[key] ?? kKeepForever}
        .default=${DEFAULT_AUDIT_SECTION[key] ?? kKeepForever}
        ?disabled=${this.disabled}
        @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
          const days = Math.round(event.detail.value);
          this.dispatchEvent(new SettingsEditEvent("audit", {
            ...value,
            [key]: days > kKeepForever ? days : null
          }));
        }}
      ></jolly-number>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-audit-retention": ProjectAuditRetention;
  }
}

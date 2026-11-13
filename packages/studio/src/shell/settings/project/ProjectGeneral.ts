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
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";
import type { KindFilter } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  AssetKindSet,
  type AssetKindEntry
} from "../../../catalog/AssetKindSet.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { SettingsEditEvent } from "../SettingsEditEvent.ts";

// CONSTANTS
const kEditorsLabel = "Editors & kinds";
const kNoEditorLabel = "No editor";

@customElement("studio-project-general")
export class ProjectGeneral extends LitElement {
  static override styles = [settingsStyles, css`
    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: var(--jolly-space-2) var(--jolly-space-3);
      align-items: start;
      margin: 0;
    }

    dt {
      padding-block: var(--jolly-space-1);
      color: var(--jolly-text-muted);
      overflow-wrap: anywhere;
    }

    dd {
      display: flex;
      flex-wrap: wrap;
      gap: var(--jolly-space-1);
      margin: 0;
    }
  `];

  @property()
  declare name: string;

  @property({ attribute: false })
  declare kinds: AssetKindSet;

  @property({ attribute: false })
  declare value: KindFilter | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.name = "";
    this.kinds = AssetKindSet.EMPTY;
    this.value = null;
    this.disabled = false;
  }

  override render(): TemplateResult {
    return html`
      <jolly-text
        label="Name"
        description="The name of the project folder"
        readonly
        .value=${this.name}
      ></jolly-text>
      ${this.value === null ? nothing : this.#editors(this.value)}
    `;
  }

  #editors(
    filter: KindFilter
  ): TemplateResult {
    return html`
      <section aria-label=${kEditorsLabel}>
        <jolly-separator label=${kEditorsLabel}></jolly-separator>
        <dl>
          ${this.kinds.byEditor().map((row) => html`
            <dt>${row.package ?? kNoEditorLabel}</dt>
            <dd>${row.kinds.map((entry) => this.#chip(filter, entry))}</dd>
          `)}
        </dl>
      </section>
    `;
  }

  #chip(
    filter: KindFilter,
    entry: AssetKindEntry
  ): TemplateResult {
    const shown = filter.shows(entry.kind);

    return html`
      <jolly-button
        data-kind=${entry.kind}
        icon=${this.kinds.kindIcon(entry.kind)}
        variant=${shown ? "accent" : "default"}
        title=${shown ? "Offered in the kind filter" : "Hidden from the kind filter"}
        .pressed=${shown}
        ?disabled=${this.disabled}
        @click=${() => {
          this.dispatchEvent(new SettingsEditEvent(
            "kindFilter",
            filter.with(entry.kind, !shown)
          ));
        }}
      >${entry.label}</jolly-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-project-general": ProjectGeneral;
  }
}

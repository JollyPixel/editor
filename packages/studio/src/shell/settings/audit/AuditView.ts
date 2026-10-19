// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../../accounts/StudioSignedIn.ts";
import {
  AUDIT_PAGES_CHANGE,
  AuditPages
} from "../../../audit/AuditPages.ts";
import { AuditRowText } from "../../../audit/AuditRowText.ts";
import {
  ACCOUNTS_CATEGORY,
  type AuditCategory,
  type AuditRow
} from "../../../audit/routes.ts";

// CONSTANTS
const kAny = "";
const kCategories: { value: AuditCategory; label: string; }[] = [
  { value: "edits", label: "Edits" },
  { value: "structure", label: "Structure" },
  { value: ACCOUNTS_CATEGORY, label: "Accounts" },
  { value: "settings", label: "Settings" }
];
const kTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

@customElement("studio-audit-view")
export class AuditView extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-3);
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--jolly-space-2);
      align-items: end;
    }

    .dates {
      display: flex;
      gap: var(--jolly-space-2);
    }

    label {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-1);
      color: var(--jolly-text-muted);
      font-size: 0.9em;
    }

    input[type="date"] {
      padding: var(--jolly-space-1);
      border: 1px solid var(--jolly-border);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-control-bg);
      color: var(--jolly-text);
      font: inherit;
      color-scheme: light dark;
    }

    ol {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--jolly-space-2);
      border: 1px solid var(--jolly-border);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-raised);
    }

    .line {
      display: flex;
      gap: var(--jolly-space-2);
      align-items: baseline;
    }

    .actor {
      font-weight: 600;
    }

    .action {
      flex: 1;
      overflow-wrap: anywhere;
    }

    time,
    .detail {
      color: var(--jolly-text-muted);
      font-size: 0.9em;
    }

    pre {
      margin: var(--jolly-space-1) 0 0;
      padding: var(--jolly-space-2);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-sunken);
      font-size: 0.85em;
      white-space: pre-wrap;
    }

    .empty {
      margin: 0;
      color: var(--jolly-text-muted);
    }

    .error {
      margin: 0;
      color: var(--jolly-danger);
    }
  `;

  @property({ attribute: false })
  declare signedIn: StudioSignedIn | null;

  @property({ attribute: false })
  declare catalog: CatalogClient | null;

  #pages = new SubscriptionController<AuditPages>(this, (pages) => {
    const repaint = (): void => this.requestUpdate();
    pages.addEventListener(AUDIT_PAGES_CHANGE, repaint);

    return [
      () => pages.removeEventListener(AUDIT_PAGES_CHANGE, repaint)
    ];
  });

  constructor() {
    super();
    this.signedIn = null;
    this.catalog = null;
  }

  override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("signedIn") && this.signedIn !== null) {
      const pages = new AuditPages(this.signedIn.audit);
      this.#pages.attach(pages);
      void pages.reload();
    }
  }

  override render(): TemplateResult | typeof nothing {
    const { signedIn } = this;
    const pages = this.#pages.current;
    if (signedIn === null || pages === null) {
      return nothing;
    }

    return html`
      ${this.#filters(signedIn, pages)}
      ${pages.error === null ? nothing : html`
        <p class="error" role="alert">${pages.error}</p>
      `}
      ${pages.rows.length === 0 && !pages.loading ?
        html`<p class="empty">Nothing recorded.</p>` :
        html`<ol aria-label="Audit entries">${pages.rows.map((row) => this.#row(row))}</ol>`}
      ${pages.hasMore ? html`
        <jolly-button
          data-action="more"
          ?disabled=${pages.loading}
          @click=${() => pages.more()}
        >Load more</jolly-button>
      ` : nothing}
    `;
  }

  #filters(
    signedIn: StudioSignedIn,
    pages: AuditPages
  ): TemplateResult {
    const { data } = pages.filters;
    const { canManageAccess } = signedIn.project.rights;
    const actors = [...signedIn.roster].map((entry) => {
      return {
        value: entry.id,
        label: entry.username
      };
    });
    const assets = this.catalog === null ? [] : [...this.catalog.records()]
      .map((record) => {
        return {
          value: record.id,
          label: record.source
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));

    return html`
      <div class="filters">
        <jolly-select
          data-filter="actor"
          label="Actor"
          label-position="top"
          .options=${[{ value: kAny, label: "Anyone" }, ...actors]}
          .value=${data.actor ?? kAny}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            void pages.filter({ actor: event.detail.value });
          }}
        ></jolly-select>
        <jolly-select
          data-filter="asset"
          label="Asset"
          label-position="top"
          .options=${[{ value: kAny, label: "Any asset" }, ...assets]}
          .value=${data.asset ?? kAny}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            void pages.filter({ asset: event.detail.value });
          }}
        ></jolly-select>
        <jolly-select
          data-filter="category"
          label="Category"
          label-position="top"
          .options=${[
            { value: kAny, label: "Everything" },
            ...kCategories.filter(
              (category) => canManageAccess || category.value !== ACCOUNTS_CATEGORY
            )
          ]}
          .value=${data.category ?? kAny}
          @jolly-change=${(event: CustomEvent<{ value: AuditCategory | ""; }>) => {
            void pages.filter({
              category: event.detail.value === kAny ? undefined : event.detail.value
            });
          }}
        ></jolly-select>
        <div class="dates">
          <label>From
            <input
              type="date"
              data-filter="from"
              .value=${data.from ?? ""}
              @change=${(event: Event) => {
                void pages.filter({ from: (event.target as HTMLInputElement).value });
              }}
            >
          </label>
          <label>To
            <input
              type="date"
              data-filter="to"
              .value=${data.to ?? ""}
              @change=${(event: Event) => {
                void pages.filter({ to: (event.target as HTMLInputElement).value });
              }}
            >
          </label>
        </div>
        <jolly-button
          data-action="refresh"
          ?disabled=${pages.loading}
          @click=${() => pages.reload()}
        >Refresh</jolly-button>
      </div>
    `;
  }

  #row(
    row: AuditRow
  ): TemplateResult {
    const text = new AuditRowText(row);

    return html`
      <li data-row=${row.type}>
        <div class="line">
          <span class="actor">${text.actor}</span>
          <span class="action">${text.action}</span>
          <time datetime=${new Date(text.at).toISOString()}>
            ${kTimeFormat.format(text.at)}
          </time>
        </div>
        ${text.detail === null ? nothing : html`
          <span class="detail">${text.detail}</span>
        `}
        ${row.type === "settings" ? html`
          <details>
            <summary>Before and after</summary>
            <pre data-side="before">${JSON.stringify(row.before, null, 2)}</pre>
            <pre data-side="after">${JSON.stringify(row.after, null, 2)}</pre>
          </details>
        ` : nothing}
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-audit-view": AuditView;
  }
}

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
  property,
  state
} from "lit/decorators.js";
import type { Right } from "@jolly-pixel/network";
import { Mixed } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/separator";

// Import Internal Dependencies
import type { AccessDraft } from "../../../project/AccessDraft.ts";
import type { CapabilityCatalog } from "../../../project/CapabilityCatalog.ts";
import type { PermissionRow } from "../../../project/permissions/PermissionRow.ts";
import type { RoomRow } from "../../../project/permissions/RoomRow.ts";
import type { RoleRules } from "../../../project/RoleRules.ts";
import { settingsStyles } from "../settingsStyles.ts";
import { AccessDraftEvent } from "./AccessEvents.ts";

// CONSTANTS
const kRightLabels: Readonly<Record<Right, string>> = {
  void: "None",
  read: "Read",
  write: "Write"
};

@customElement("studio-role-permissions")
export class RolePermissions extends LitElement {
  static override styles = [settingsStyles, css`
    .blocks {
      display: grid;
    }

    .block {
      display: grid;
      gap: 2px;
      padding: 3px var(--jolly-space-1);
      border-radius: var(--jolly-radius-sm);
    }

    .block:nth-child(even) {
      background: color-mix(in srgb, var(--jolly-surface-sunken) 40%, transparent);
    }

    .row {
      display: flex;
      align-items: center;

      --lead: 0px;
    }

    .row.kind {
      --lead: 40px;
    }

    .row.capability {
      padding-inline-start: 56px;

      --lead: 56px;
    }

    .lead {
      display: flex;
      flex: 0 0 var(--lead);
      align-items: center;
      gap: var(--jolly-space-1);
    }

    .fold {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: var(--jolly-radius-sm);
      background: none;
      color: var(--jolly-text-muted);
      cursor: pointer;
    }

    .fold:hover {
      background: var(--jolly-control-bg-hover);
    }

    .fold:focus-visible {
      outline: 2px solid var(--jolly-focus-ring);
      outline-offset: -2px;
    }

    .fold jolly-icon {
      width: 12px;
      height: 12px;
      transition: rotate 120ms ease-out;
    }

    .fold[aria-expanded="true"] jolly-icon {
      rotate: 90deg;
    }

    .lead > jolly-icon {
      width: 16px;
      height: 16px;
    }

    jolly-button-group {
      width: calc(
        var(--jolly-field-inset-start, var(--jolly-space-1)) +
        var(--jolly-field-inset-end, 0px) +
        var(--jolly-label-width) +
        2 * var(--jolly-space-1) +
        var(--segments) * (var(--studio-permission-segment) + 1px) - 1px
      );
      max-width: 100%;

      --jolly-label-width: calc(220px - var(--lead));
      --jolly-label-max-width: none;
      --studio-permission-segment: 64px;
    }
  `];

  @property({ attribute: false })
  declare catalog: CapabilityCatalog | null;

  @property({ attribute: false })
  declare draft: AccessDraft | null;

  @property({ attribute: false })
  declare role: string;

  @state()
  declare _open: ReadonlyMap<string, boolean>;

  constructor() {
    super();
    this.catalog = null;
    this.draft = null;
    this.role = "";
    this._open = new Map();
  }

  override render(): TemplateResult | typeof nothing {
    const { catalog, draft, role } = this;
    if (catalog === null || draft === null) {
      return nothing;
    }
    const rules = draft.rules(role);

    return html`
      <section data-group="project" aria-label="Project">
        <jolly-separator label="Project"></jolly-separator>
        <div class="blocks">
          ${catalog.project.map((row) => html`
            <div class="block"><div class="row">${this.#field(draft, rules, row)}</div></div>
          `)}
        </div>
      </section>
      <section data-group="kinds" aria-label="Kinds">
        <jolly-separator label="Kinds"></jolly-separator>
        <jolly-message flush>Read opens assets without editing them; Write edits them.</jolly-message>
        <div class="blocks">
          ${catalog.kinds.map((kind) => this.#kind(draft, rules, kind))}
        </div>
      </section>
    `;
  }

  #kind(
    draft: AccessDraft,
    rules: RoleRules,
    kind: RoomRow
  ): TemplateResult {
    const foldable = kind.capabilities.length > 0;
    const open = foldable &&
      (this._open.get(kind.id) ?? kind.rightIn(rules) === "mixed");

    return html`
      <div class="block">
        <div class="row kind" data-kind=${kind.id}>
          <span class="lead">
            ${foldable ? html`
              <button
                class="fold"
                aria-expanded=${open ? "true" : "false"}
                aria-label=${`${kind.label} capabilities`}
                @click=${() => {
                  this._open = new Map(this._open).set(kind.id, !open);
                }}
              ><jolly-icon name="chevron"></jolly-icon></button>
            ` : html`<span class="fold" aria-hidden="true"></span>`}
            ${kind.icon === undefined ? nothing : html`<jolly-icon name=${kind.icon}></jolly-icon>`}
          </span>
          ${this.#field(draft, rules, kind)}
        </div>
        ${open ? kind.capabilities.map((capability) => html`
          <div class="row capability">${this.#field(draft, rules, capability)}</div>
        `) : nothing}
      </div>
    `;
  }

  #field(
    draft: AccessDraft,
    rules: RoleRules,
    row: PermissionRow
  ): TemplateResult {
    const shown = row.rightIn(rules);

    return html`
      <jolly-button-group
        data-permission=${row.id}
        label=${row.label}
        description=${row.description ?? nothing}
        description-display="tooltip"
        style=${`--segments: ${row.options.length}`}
        ?disabled=${!row.reachable(rules)}
        .options=${row.options.map((right) => {
          return {
            value: right,
            label: kRightLabels[right]
          };
        })}
        .value=${shown === "mixed" ? Mixed : shown}
        @jolly-change=${(event: CustomEvent<{ value: Right; }>) => {
          this.dispatchEvent(new AccessDraftEvent(
            draft.withRules(this.role, row.applyTo(rules, event.detail.value))
          ));
        }}
      ></jolly-button-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-role-permissions": RolePermissions;
  }
}

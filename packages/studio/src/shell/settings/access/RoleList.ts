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
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import type { RoleSummary } from "../../../project/RoleSummary.ts";

export class RoleSelectEvent extends Event {
  readonly role: string;

  constructor(
    role: string
  ) {
    super("role-select");
    this.role = role;
  }
}

@customElement("studio-role-list")
export class RoleList extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2);
    }

    ul {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    button {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
      width: 100%;
      box-sizing: border-box;
      min-height: 28px;
      padding: 0 var(--jolly-space-2);
      border: none;
      border-radius: var(--jolly-radius-sm);
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    button:hover {
      background: var(--jolly-control-bg-hover);
    }

    button[aria-current="true"] {
      background: var(--jolly-control-bg-active);
      font-weight: 600;
    }

    button:focus-visible {
      outline: 2px solid var(--jolly-focus-ring);
      outline-offset: -2px;
    }

    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      color: var(--jolly-text-muted);
      font-size: 0.9em;
    }

    jolly-icon {
      width: 14px;
      height: 14px;
      color: var(--jolly-text-muted);
    }
  `;

  @property({ attribute: false })
  declare roles: readonly RoleSummary[];

  @property({ attribute: false })
  declare selected: string;

  constructor() {
    super();
    this.roles = [];
    this.selected = "";
  }

  override render(): TemplateResult {
    return html`
      <jolly-button
        data-action="create-role"
        icon="plus"
        @click=${() => this.dispatchEvent(new Event("role-create"))}
      >Create role</jolly-button>
      <ul aria-label="Roles">
        ${this.roles.map((role) => html`
          <li>
            <button
              data-role=${role.name}
              aria-current=${role.name === this.selected ? "true" : "false"}
              title=${role.description ?? nothing}
              @click=${() => this.dispatchEvent(new RoleSelectEvent(role.name))}
            >
              ${role.builtIn ? html`<jolly-icon name="lock" aria-label="Built in"></jolly-icon>` : nothing}
              <span class="name">${role.name}</span>
              ${role.isDefault ? html`<span class="meta">default</span>` : nothing}
              ${role.members === null ? nothing : html`
                <span class="meta" aria-label="${role.members} members">${role.members}</span>
              `}
            </button>
          </li>
        `)}
      </ul>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-role-list": RoleList;
  }

  interface HTMLElementEventMap {
    "role-select": RoleSelectEvent;
    "role-create": Event;
  }
}

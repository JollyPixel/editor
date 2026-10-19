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
import { ADMIN_ROLE, GUEST_ROLE } from "@jolly-pixel/accounts";
import type { Right } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AccessDraft } from "../../../project/AccessDraft.ts";
import type { RoleRules } from "../../../project/RoleRules.ts";
import {
  AUDIT_RIGHT,
  BUILT_IN_ROLES,
  SETTINGS_RIGHT
} from "../../../project/routes.ts";

// CONSTANTS
const kNewPattern = "room.*";
const kRightOptions: { value: Right; label: string; }[] = [
  { value: "write", label: "Write" },
  { value: "read", label: "Read" },
  { value: "void", label: "None" }
];
const kBuiltInDescriptions: Readonly<Record<string, string>> = {
  [ADMIN_ROLE]: "Writes everything and manages the project. Built in.",
  [GUEST_ROLE]: "Opens a share link: reads the shared asset only. Built in."
};

export class AccessDraftEvent extends Event {
  readonly draft: AccessDraft;

  constructor(
    draft: AccessDraft
  ) {
    super("access-draft", {
      bubbles: true,
      composed: true
    });
    this.draft = draft;
  }
}

@customElement("studio-roles-editor")
export class RolesEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2);
    }

    .add-role {
      display: flex;
      align-items: end;
      gap: var(--jolly-space-2);
    }

    .add-role jolly-text {
      flex: 1;
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
      align-items: center;
      gap: var(--jolly-space-2);
      padding: var(--jolly-space-1);
      border: 1px solid var(--jolly-border);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-raised);

      --jolly-label-width: auto;
    }

    li[data-matched] {
      border-color: var(--jolly-accent);
    }

    li[data-dragging] {
      opacity: 0.5;
    }

    .handle {
      cursor: grab;
      color: var(--jolly-text-muted);
      user-select: none;
    }

    li jolly-text {
      flex: 1;
    }

    li jolly-select {
      flex: 0 0 120px;
    }

    .muted {
      margin: 0;
      color: var(--jolly-text-muted);
    }

    .error {
      margin: 0;
      color: var(--jolly-danger);
    }
  `;

  @property({ attribute: false })
  declare draft: AccessDraft | null;

  @state()
  declare _role: string;

  @state()
  declare _probe: string;

  @state()
  declare _newRole: string;

  @state()
  declare _error: string | null;

  @state()
  declare _dragging: number | null;

  constructor() {
    super();
    this.draft = null;
    this._role = "";
    this._probe = "";
    this._newRole = "";
    this._error = null;
    this._dragging = null;
  }

  override render(): TemplateResult | typeof nothing {
    const { draft } = this;
    if (draft === null) {
      return nothing;
    }

    const roles = [...BUILT_IN_ROLES, ...draft.roles];
    const role = roles.includes(this._role) ? this._role : draft.defaultRole;

    return html`
      <jolly-select
        data-field="role"
        label="Role"
        .options=${roles.map((name) => {
          return {
            value: name,
            label: name
          };
        })}
        .value=${role}
        @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
          this._role = event.detail.value;
          this._error = null;
        }}
      ></jolly-select>
      ${BUILT_IN_ROLES.includes(role) ?
        html`<p class="muted">${kBuiltInDescriptions[role]}</p>` :
        this.#declared(draft, role)}
      <div class="add-role">
        <jolly-text
          data-field="new-role"
          label="New role"
          placeholder="Name"
          .value=${this._newRole}
          @jolly-input=${(event: CustomEvent<{ value: string; }>) => {
            this._newRole = event.detail.value;
          }}
        ></jolly-text>
        <jolly-button
          data-action="add-role"
          ?disabled=${this._newRole.trim() === ""}
          @click=${this.#addRole}
        >Add role</jolly-button>
      </div>
      ${this._error === null ? nothing : html`
        <p class="error" role="alert">${this._error}</p>
      `}
    `;
  }

  #declared(
    draft: AccessDraft,
    role: string
  ): TemplateResult {
    const rules = draft.rules(role);
    const match = this._probe === "" ? null : rules.match(this._probe);

    return html`
      <jolly-checkbox
        data-grant="settings"
        label="Project settings"
        description="Sees the Project settings; write also edits General and Editors"
        .value=${rules.grants(SETTINGS_RIGHT)}
        @jolly-change=${(event: CustomEvent<{ value: boolean; }>) => {
          this.#emit(draft.withRules(role, rules.withGrant(SETTINGS_RIGHT, event.detail.value)));
        }}
      ></jolly-checkbox>
      <jolly-checkbox
        data-grant="audit"
        label="Audit"
        description="Sees the project's audit log"
        .value=${rules.grants(AUDIT_RIGHT)}
        @jolly-change=${(event: CustomEvent<{ value: boolean; }>) => {
          this.#emit(draft.withRules(role, rules.withGrant(AUDIT_RIGHT, event.detail.value)));
        }}
      ></jolly-checkbox>
      <ol aria-label="Rules, first match wins">
        ${[...rules].map((_rule, index) => this.#rule(
          (next) => this.#emit(draft.withRules(role, next)),
          rules,
          index,
          match?.index === index
        ))}
      </ol>
      <jolly-toolbar label="Role actions">
        <jolly-button
          data-action="add-rule"
          @click=${() => {
            this.#emit(draft.withRules(role, rules.add({
              pattern: unusedPattern(rules),
              right: "read"
            })));
          }}
        >Add rule</jolly-button>
        <jolly-button
          data-action="delete-role"
          ?disabled=${role === draft.defaultRole}
          title=${role === draft.defaultRole ? "New accounts get this role" : "Delete this role"}
          @click=${() => this.#deleteRole(draft, role)}
        >Delete role</jolly-button>
      </jolly-toolbar>
      <jolly-text
        data-field="probe"
        label="Check a room"
        description="A room event such as voxelmap.$join"
        description-display="tooltip"
        placeholder="room.event"
        .value=${this._probe}
        @jolly-input=${(event: CustomEvent<{ value: string; }>) => {
          this._probe = event.detail.value.trim();
        }}
      ></jolly-text>
      ${this._probe === "" ? nothing : html`
        <p class="muted" data-probe-result aria-live="polite">
          ${match === null ?
            "No rule matches: none." :
            `Rule ${match.index + 1} (${match.rule.pattern}) gives ${match.rule.right}.`}
        </p>
      `}
    `;
  }

  #rule(
    update: (next: RoleRules) => void,
    rules: RoleRules,
    index: number,
    matched: boolean
  ): TemplateResult {
    const rule = rules.at(index);
    if (rule === undefined) {
      return html``;
    }

    return html`
      <li
        draggable="true"
        data-rule=${index}
        ?data-matched=${matched}
        ?data-dragging=${this._dragging === index}
        @dragstart=${(event: DragEvent) => {
          this._dragging = index;
          event.dataTransfer?.setData("text/plain", String(index));
        }}
        @dragend=${() => {
          this._dragging = null;
        }}
        @dragover=${(event: DragEvent) => event.preventDefault()}
        @drop=${(event: DragEvent) => {
          event.preventDefault();
          if (this._dragging !== null) {
            update(rules.move(this._dragging, index));
          }
          this._dragging = null;
        }}
        @keydown=${(event: KeyboardEvent) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
            return;
          }
          event.preventDefault();
          update(rules.move(index, index + (event.key === "ArrowUp" ? -1 : 1)));
        }}
      >
        <jolly-icon class="handle" name="drag"></jolly-icon>
        <jolly-text
          label="Pattern"
          .value=${rule.pattern}
          @jolly-change=${(event: CustomEvent<{ value: string; }>) => {
            const pattern = event.detail.value.trim();
            if (pattern !== "") {
              update(rules.replace(index, { ...rule, pattern }));
            }
          }}
        ></jolly-text>
        <jolly-select
          label="Right"
          .options=${kRightOptions}
          .value=${rule.right}
          @jolly-change=${(event: CustomEvent<{ value: Right; }>) => {
            update(rules.replace(index, { ...rule, right: event.detail.value }));
          }}
        ></jolly-select>
        <jolly-button
          icon="trash"
          icon-only
          label="Remove rule"
          title="Remove rule (Alt+Up and Alt+Down move it)"
          @click=${() => update(rules.remove(index))}
        ></jolly-button>
      </li>
    `;
  }

  readonly #addRole = (): void => {
    if (this.draft === null) {
      return;
    }

    try {
      const name = this._newRole.trim();
      this.#emit(this.draft.addRole(name));
      this._role = name;
      this._newRole = "";
    }
    catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    }
  };

  #deleteRole(
    draft: AccessDraft,
    role: string
  ): void {
    try {
      this.#emit(draft.deleteRole(role));
      this._role = draft.defaultRole;
    }
    catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    }
  }

  #emit(
    draft: AccessDraft
  ): void {
    this._error = null;
    this.dispatchEvent(new AccessDraftEvent(draft));
  }
}

function unusedPattern(
  rules: RoleRules
): string {
  const patterns = new Set([...rules].map(({ pattern }) => pattern));
  let suffix = 1;
  while (patterns.has(suffix === 1 ? kNewPattern : `${kNewPattern}${suffix}`)) {
    suffix++;
  }

  return suffix === 1 ? kNewPattern : `${kNewPattern}${suffix}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-roles-editor": RolesEditor;
  }

  interface HTMLElementEventMap {
    "access-draft": AccessDraftEvent;
  }
}

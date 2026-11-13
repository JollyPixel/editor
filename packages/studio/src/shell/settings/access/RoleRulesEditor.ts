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
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/toolbar";
import "@jolly-pixel/ui/elements/message";

// Import Internal Dependencies
import type { AccessDraft } from "../../../project/AccessDraft.ts";
import type {
  RoleRule,
  RoleRules
} from "../../../project/RoleRules.ts";
import { unusedName } from "../../../project/unusedName.ts";
import { AccessDraftEvent } from "./AccessEvents.ts";

// CONSTANTS
const kNewPattern = "room.*";
const kRightOptions: { value: Right; label: string; }[] = [
  { value: "write", label: "Write" },
  { value: "read", label: "Read" },
  { value: "void", label: "None" }
];

@customElement("studio-role-rules-editor")
export class RoleRulesEditor extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2);
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
      border-color: var(--jolly-accent-fill);
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
  `;

  @property({ attribute: false })
  declare draft: AccessDraft | null;

  @property({ attribute: false })
  declare role: string;

  @property({ attribute: false })
  declare suggestions: readonly string[];

  @state()
  declare _probe: string;

  @state()
  declare _dragging: number | null;

  constructor() {
    super();
    this.draft = null;
    this.role = "";
    this.suggestions = [];
    this._probe = "";
    this._dragging = null;
  }

  override render(): TemplateResult | typeof nothing {
    const { draft, role } = this;
    if (draft === null) {
      return nothing;
    }
    const rules = draft.rules(role);
    const match = this._probe === "" ? null : rules.match(this._probe);
    const update = (next: RoleRules) => {
      this.dispatchEvent(new AccessDraftEvent(draft.withRules(role, next)));
    };

    return html`
      <ol aria-label="Rules, first match wins">
        ${[...rules].map((rule, index) => this.#rule(
          update,
          rules,
          rule,
          index,
          match?.index === index
        ))}
      </ol>
      <jolly-toolbar label="Rule actions">
        <jolly-button
          data-action="add-rule"
          @click=${() => update(rules.withExact({ [unusedPattern(rules)]: "read" }))}
        >Add rule</jolly-button>
      </jolly-toolbar>
      <jolly-text
        data-field="probe"
        label="Check a room"
        description="A room event such as voxelmap.$join"
        description-display="tooltip"
        placeholder="room.event"
        .suggestions=${this.suggestions}
        .value=${this._probe}
        @jolly-input=${(event: CustomEvent<{ value: string; }>) => {
          this._probe = event.detail.value.trim();
        }}
      ></jolly-text>
      ${this._probe === "" ? nothing : html`
        <jolly-message flush data-probe-result aria-live="polite">
          ${match === null ?
            "No rule matches: none." :
            `Rule ${match.index + 1} (${match.rule.pattern}) gives ${match.rule.right}.`}
        </jolly-message>
      `}
    `;
  }

  #rule(
    update: (next: RoleRules) => void,
    rules: RoleRules,
    rule: RoleRule,
    index: number,
    matched: boolean
  ): TemplateResult {
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
          .suggestions=${this.suggestions}
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
}

function unusedPattern(
  rules: RoleRules
): string {
  const patterns = new Set([...rules].map(({ pattern }) => pattern));

  return unusedName(kNewPattern, (pattern) => patterns.has(pattern), "");
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-role-rules-editor": RoleRulesEditor;
  }
}

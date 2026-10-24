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
  property,
  state
} from "lit/decorators.js";
import { KeyboardLayoutStore } from "@jolly-pixel/controls";
import {
  ChordConflictError,
  type PreferenceScope,
  type Preferences
} from "@jolly-pixel/editor.host/preferences";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/search";
import "@jolly-pixel/ui/elements/separator";

// Import Internal Dependencies
import { KeyRecorder } from "../../keybindings/KeyRecorder.ts";
import {
  KeybindingTable,
  type KeybindingRow,
  type KeybindingSection
} from "../../keybindings/KeybindingTable.ts";
import { settingsStyles } from "./settingsStyles.ts";

@customElement("studio-keybinding-settings")
export class KeybindingSettings extends LitElement {
  static override styles = [settingsStyles, css`
    jolly-search {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--studio-card);
    }

    h4 {
      margin: var(--jolly-space-2) 0 0;
      padding-inline: var(--jolly-space-1);
      color: var(--jolly-accent-text);
      font-size: 1em;
      font-weight: 700;
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
      min-height: var(--jolly-control-height);
      padding-inline-start: var(--jolly-space-1);
    }

    .label {
      flex: 1;
      min-width: 0;
    }

    kbd {
      padding: 1px var(--jolly-space-1);
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-control-bg);
      font: inherit;
    }

    .unbound,
    .recording {
      color: var(--jolly-text-muted);
    }

    .clash {
      margin: 0 0 var(--jolly-space-1);
      padding-inline-start: var(--jolly-space-1);
      color: var(--jolly-warning);
      font-size: 0.9em;
    }
  `];

  @property({ attribute: false })
  declare scopes: readonly PreferenceScope[];

  @property({ attribute: false })
  declare shortcutScopes: readonly PreferenceScope[];

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @state()
  declare _query: string;

  @state()
  declare _error: string;

  @state()
  declare _version: number;

  #table: KeybindingTable | null = null;
  #unsubscribe: (() => void) | null = null;
  #layout = new KeyboardLayoutStore();
  #stopLayout: (() => void) | null = null;
  #recorder = new KeyRecorder({
    onChange: () => this.requestUpdate(),
    onRecorded: (recording, bindings) => this.#write(
      recording.scope,
      (preferences) => preferences.assign(
        recording.scope,
        recording.action,
        bindings
      )
    )
  });

  constructor() {
    super();
    this.scopes = [];
    this.shortcutScopes = [];
    this.preferences = null;
    this._query = "";
    this._error = "";
    this._version = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#follow();
    const stopWatching = this.#layout.watch(window);
    const stopListening = this.#layout.subscribe("change", () => {
      this._version++;
    });
    this.#stopLayout = () => {
      stopWatching();
      stopListening();
    };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#recorder.stop();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#stopLayout?.();
    this.#stopLayout = null;
  }

  override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (
      changed.has("scopes") ||
      changed.has("shortcutScopes") ||
      changed.has("preferences")
    ) {
      this.#follow();
    }
  }

  override render(): TemplateResult | typeof nothing {
    if (this.#table === null) {
      return nothing;
    }

    const sections = this.#table.sections(this._query);

    return html`
      <jolly-search
        placeholder="Search shortcuts"
        label="Search shortcuts"
        @jolly-input=${(event: CustomEvent<{ value: string; }>) => {
          this._query = event.detail.value;
        }}
      ></jolly-search>
      ${this._error === "" ? nothing : html`<p class="error" role="alert">${this._error}</p>`}
      ${sections.map((section) => this.#section(section))}
    `;
  }

  #section(
    section: KeybindingSection
  ): TemplateResult {
    const { scope } = section;

    return html`
      <section data-scope=${scope.name}>
        <jolly-separator label=${scope.label}>
          <jolly-button
            slot="actions"
            icon="revert"
            ?disabled=${!section.customized}
            @click=${() => this.#write(scope, (preferences) => preferences.reset(scope))}
          >Reset all</jolly-button>
        </jolly-separator>
        ${section.groups.map((group) => html`
          ${group.label === null ? nothing : html`<h4>${group.label}</h4>`}
          ${group.rows.map((row) => this.#row(scope, row))}
        `)}
      </section>
    `;
  }

  #row(
    scope: PreferenceScope,
    row: KeybindingRow
  ): TemplateResult {
    const current = this.#recorder.recording;
    const recording = current?.scope === scope &&
      current.action === row.action;
    const prompt = row.kind === "key" ? "Press a key" : "Press a shortcut";

    return html`
      <div class="row" data-action=${row.action}>
        <span class="label">${row.label}</span>
        ${recording ?
          html`<span class="recording">${prompt}, Esc cancels</span>` :
          this.#chords(row)}
        <jolly-button
          @click=${() => this.#record(scope, row)}
        >Change</jolly-button>
        <jolly-button
          icon="close"
          icon-only
          label="Unbind"
          title="Unbind"
          ?disabled=${row.chords.length === 0}
          @click=${() => this.#write(
            scope,
            (preferences) => preferences.assign(scope, row.action, [])
          )}
        ></jolly-button>
        <jolly-button
          icon="revert"
          icon-only
          label="Reset"
          title="Reset"
          ?disabled=${!row.customized}
          @click=${() => this.#write(
            scope,
            (preferences) => preferences.reset(scope, row.action)
          )}
        ></jolly-button>
      </div>
      ${row.clashes.length === 0 ? nothing : html`
        <p class="clash" data-clash=${row.action}>
          Also triggers ${row.clashes.join(", ")}.
        </p>
      `}
    `;
  }

  #chords(
    row: KeybindingRow
  ): TemplateResult {
    if (row.chords.length === 0) {
      return html`<span class="unbound">Unbound</span>`;
    }

    return html`${row.chords.map((chord) => html`<kbd>${chord.label}</kbd>`)}`;
  }

  #follow(): void {
    this.#unsubscribe?.();
    const { preferences } = this;
    this.#table = preferences === null ?
      null :
      new KeybindingTable(this.scopes, preferences, {
        layout: this.#layout,
        shortcutScopes: this.shortcutScopes
      });
    this.#unsubscribe = preferences?.subscribe(() => {
      this._version++;
    }) ?? null;
  }

  #record(
    scope: PreferenceScope,
    row: KeybindingRow
  ): void {
    this._error = "";
    this.#recorder.start({
      scope,
      action: row.action,
      kind: row.kind
    });
  }

  #write(
    scope: PreferenceScope,
    write: (preferences: Preferences) => void
  ): void {
    if (this.preferences === null) {
      return;
    }

    this._error = "";
    try {
      write(this.preferences);
    }
    catch (error) {
      if (!(error instanceof ChordConflictError) || this.#table === null) {
        throw error;
      }

      this._error = this.#table.conflictMessage(error, scope);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-keybinding-settings": KeybindingSettings;
  }
}

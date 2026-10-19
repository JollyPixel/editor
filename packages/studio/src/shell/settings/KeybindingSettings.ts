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
import {
  ChordConflictError,
  type PreferenceScope,
  type Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { BoundChord } from "../../keybindings/BoundChord.ts";
import {
  KeybindingTable,
  type KeybindingRow,
  type KeybindingSection
} from "../../keybindings/KeybindingTable.ts";

interface Recording {
  scope: PreferenceScope;
  action: string;
}

@customElement("studio-keybinding-settings")
export class KeybindingSettings extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-3);
    }

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-1);
    }

    header {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
    }

    h3,
    h4 {
      flex: 1;
      margin: 0;
      padding-inline: var(--jolly-space-1);
      font-size: 1em;
    }

    h4 {
      color: var(--jolly-text-muted);
      font-weight: 600;
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
      min-height: var(--jolly-control-height);
      padding-inline: var(--jolly-space-1);
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

    .error {
      margin: 0;
      padding-inline: var(--jolly-space-1);
      color: var(--jolly-danger);
    }
  `;

  @property({ attribute: false })
  declare scopes: readonly PreferenceScope[];

  @property({ attribute: false })
  declare preferences: Preferences | null;

  @state()
  declare _query: string;

  @state()
  declare _recording: Recording | null;

  @state()
  declare _error: string;

  @state()
  declare _version: number;

  #table: KeybindingTable | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.scopes = [];
    this.preferences = null;
    this._query = "";
    this._recording = null;
    this._error = "";
    this._version = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#follow();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopRecording();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("scopes") || changed.has("preferences")) {
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
        <header>
          <h3>${scope.label}</h3>
          <jolly-button
            icon="revert"
            ?disabled=${!section.customized}
            @click=${() => this.#write(scope, (preferences) => preferences.reset(scope))}
          >Reset all</jolly-button>
        </header>
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
    const recording = this._recording?.scope === scope &&
      this._recording.action === row.action;

    return html`
      <div class="row" data-action=${row.action}>
        <span class="label">${row.label}</span>
        ${recording ?
          html`<span class="recording">Press a shortcut, Esc cancels</span>` :
          this.#chords(row)}
        <jolly-button
          @click=${() => this.#record(scope, row.action)}
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
      new KeybindingTable(this.scopes, preferences);
    this.#unsubscribe = preferences?.subscribe(() => {
      this._version++;
    }) ?? null;
  }

  #record(
    scope: PreferenceScope,
    action: string
  ): void {
    this.#stopRecording();
    this._error = "";
    this._recording = {
      scope,
      action
    };
    window.addEventListener("keydown", this.#onKeyDown, { capture: true });
  }

  #stopRecording(): void {
    window.removeEventListener("keydown", this.#onKeyDown, { capture: true });
    this._recording = null;
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
      if (!(error instanceof ChordConflictError)) {
        throw error;
      }

      const chord = BoundChord.parse(error.chord)?.label ?? error.chord;
      const owner = scope.fields[error.owner]?.label ?? error.owner;
      this._error = `${chord} is already bound to "${owner}".`;
    }
  }

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const recording = this._recording;
    if (recording === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      this.#stopRecording();

      return;
    }

    const chord = BoundChord.capture(event);
    if (chord === null) {
      return;
    }

    this.#stopRecording();
    this.#write(
      recording.scope,
      (preferences) => preferences.assign(
        recording.scope,
        recording.action,
        [chord.value]
      )
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-keybinding-settings": KeybindingSettings;
  }
}

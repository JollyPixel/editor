// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import type { EditorArchives } from "../session/EditorArchives.ts";

/**
 * Export, import and reset buttons for an `EditorArchives`, with the notice
 * of a volatile workspace and the error of the last failed flow.
 */
export class ArchiveActions extends LitElement {
  static override properties: PropertyDeclarations = {
    archives: { attribute: false },
    busy: { state: true },
    error: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    input[type="file"] {
      display: none;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--jolly-row-gap, 4px);
    }

    .notice,
    .error {
      font-size: 11px;
      margin: 0;
    }

    .notice {
      color: var(--jolly-text-muted, #888);
    }

    .error {
      color: var(--jolly-danger, #e5484d);
    }
  `;

  declare archives: EditorArchives | null;
  declare protected busy: boolean;
  declare protected error: string | null;

  constructor() {
    super();
    this.archives = null;
    this.busy = false;
    this.error = null;
  }

  get #fileInput(): HTMLInputElement {
    return this.renderRoot.querySelector<HTMLInputElement>("#file-input")!;
  }

  override render(): TemplateResult | typeof nothing {
    const { archives } = this;
    if (archives === null) {
      return nothing;
    }

    return html`
      <div class="actions">
        <jolly-button
          id="export-archive"
          ?disabled=${this.busy}
          @click=${this.#onExport}
        >Export (.zip)</jolly-button>
        <jolly-button
          id="import-archive"
          ?disabled=${this.busy || !archives.canImport}
          @click=${this.#onImport}
        >Import (.zip)</jolly-button>
        ${archives.canReset ?
          html`
            <jolly-button
              id="reset-workspace"
              variant="danger"
              ?disabled=${this.busy}
              @click=${this.#onReset}
            >Reset workspace</jolly-button>
          ` :
          nothing}
      </div>
      ${archives.volatile ?
        html`
          <p class="notice">
            This workspace is open in another tab. Changes made here are not
            saved and importing is disabled.
          </p>
        ` :
        nothing}
      ${this.error === null ?
        nothing :
        html`<p class="error" role="alert">${this.error}</p>`}
      <input
        type="file"
        id="file-input"
        accept=".zip,application/zip"
        @change=${this.#onFileSelected}
      />
    `;
  }

  readonly #onExport = async(): Promise<void> => {
    await this.#run((archives) => archives.download());
  };

  readonly #onImport = (): void => {
    this.#fileInput.value = "";
    this.#fileInput.click();
  };

  readonly #onFileSelected = async(): Promise<void> => {
    const file = this.#fileInput.files?.[0];
    if (!file) {
      return;
    }

    await this.#run((archives) => archives.importFile(file));
  };

  readonly #onReset = async(): Promise<void> => {
    await this.#run((archives) => archives.reset());
  };

  async #run(
    task: (archives: EditorArchives) => Promise<void>
  ): Promise<void> {
    const { archives } = this;
    if (archives === null) {
      return;
    }

    this.busy = true;
    this.error = null;
    try {
      await task(archives);
    }
    catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    finally {
      this.busy = false;
    }
  }
}

customElements.define("jolly-archive-actions", ArchiveActions);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-archive-actions": ArchiveActions;
  }
}

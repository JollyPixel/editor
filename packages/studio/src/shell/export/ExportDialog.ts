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
  query,
  state
} from "lit/decorators.js";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  Dialog,
  JollyChangeDetail
} from "@jolly-pixel/ui";
import { errorMessage } from "@jolly-pixel/utils";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/text";

// Import Internal Dependencies
import type { StudioSignedIn } from "../../accounts/StudioSignedIn.ts";
import { BrowserState } from "../../browser/BrowserState.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";
import type { ExportTarget } from "./ExportTarget.ts";
import { ExportTargets } from "./ExportTargets.ts";

export interface ExportRequest {
  user: StudioSignedIn;
  defaultScene: AssetRecordData | null;
}

@customElement("studio-export-dialog")
export class ExportDialog extends LitElement {
  static override styles = css`
    jolly-button-group {
      width: min(480px, calc(100vw - 80px));
    }

    .status {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2, 8px);
      min-height: var(--jolly-control-height, 20px);
      color: var(--jolly-text-muted);
    }

    .status span {
      flex: 1;
    }
  `;

  @property({ attribute: false })
  declare browserState: BrowserState;

  @state()
  declare _request: ExportRequest | null;

  @state()
  declare _target: ExportTarget;

  @state()
  declare _fileName: string;

  @state()
  declare _busy: boolean;

  @state()
  declare _error: string | null;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  #targets = ExportTargets.STUDIO;

  constructor() {
    super();
    this.browserState = new BrowserState();
    this._request = null;
    this._target = this.#targets.initial("", null);
    this._fileName = "";
    this._busy = false;
    this._error = null;
  }

  async open(
    request: ExportRequest
  ): Promise<void> {
    this._request = request;
    this._target = this.#targets.initial(
      this.browserState.exportTarget,
      request.defaultScene
    );
    this._fileName = "";
    this._busy = false;
    this._error = null;

    await this.updateComplete;
    await this._dialog.showModal();
  }

  override render(): TemplateResult {
    const blocker = this._target.blocker(
      this._request?.defaultScene ?? null
    );
    const exportable = blocker === null && !this._busy;

    return html`
      <jolly-dialog
        heading="Export"
        icon="export"
        ?dismissible=${!this._busy}
      >
        <jolly-button-group
          layout="tiles"
          aria-label="Export target"
          .options=${this.#targets.options()}
          .value=${this._target.name}
          ?disabled=${this._busy}
          @jolly-change=${this.#onTargetChange}
        ></jolly-button-group>
        <p class="status" role="status">
          ${blocker === null ? html`
            <span>${this._target.summary}</span>
          ` : html`
            <span>${blocker.reason}</span>
            <jolly-button
              data-action="settings"
              @click=${() => this.#openSettings(blocker.settingsSection)}
            >Open settings</jolly-button>
          `}
        </p>
        <jolly-text
          label="File name"
          placeholder="Default name"
          .value=${this._fileName}
          ?disabled=${!exportable}
          @jolly-input=${this.#onFileNameInput}
        ></jolly-text>
        ${this._error === null ? nothing : html`
          <jolly-message tone="danger" role="alert">${this._error}</jolly-message>
        `}
        <jolly-button
          slot="actions"
          variant="accent"
          data-action="export"
          ?disabled=${!exportable}
          @click=${this.#export}
        >${this._busy ? "Exporting…" : "Export"}</jolly-button>
        <jolly-button
          slot="actions"
          data-action="cancel"
          ?disabled=${this._busy}
          @click=${this.#close}
        >Cancel</jolly-button>
      </jolly-dialog>
    `;
  }

  #onTargetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    const target = this.#targets.find(event.detail.value);
    if (target === undefined) {
      return;
    }

    this._target = target;
    this._error = null;
    this.browserState.exportTarget = target.name;
  }

  #onFileNameInput(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._fileName = event.detail.value;
  }

  #openSettings(
    section: string
  ): void {
    this.#close();
    this.dispatchEvent(new SettingsOpenEvent(section));
  }

  async #export(): Promise<void> {
    const request = this._request;
    if (request === null || this._busy) {
      return;
    }

    this._busy = true;
    this._error = null;
    try {
      const download = await this._target.download(request.user);
      download.renamed(this._fileName).save();
      this._dialog.close("export");
    }
    catch (error) {
      this._error = `Could not export: ${errorMessage(error)}`;
    }
    finally {
      this._busy = false;
    }
  }

  #close(): void {
    this._dialog.close("cancel");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-export-dialog": ExportDialog;
  }
}

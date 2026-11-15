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
import type { GameExportAssets } from "@jolly-pixel/server";
import type {
  Dialog,
  JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/text";

// Import Internal Dependencies
import { BrowserState } from "../../browser/BrowserState.ts";
import { SettingsOpenEvent } from "../settings/SettingsOpenEvent.ts";
import { ExportStartEvent } from "./ExportStartEvent.ts";
import type { ExportTarget } from "./ExportTarget.ts";
import { ExportTargets } from "./ExportTargets.ts";

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
  declare _defaultScene: AssetRecordData | null;

  @state()
  declare _target: ExportTarget;

  @state()
  declare _fileName: string;

  @state()
  declare _assets: GameExportAssets;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  #targets = ExportTargets.STUDIO;

  constructor() {
    super();
    this.browserState = new BrowserState();
    this._defaultScene = null;
    this._target = this.#targets.initial("", null);
    this._fileName = "";
    this._assets = "reachable";
  }

  async open(
    defaultScene: AssetRecordData | null
  ): Promise<void> {
    this._defaultScene = defaultScene;
    this._target = this.#targets.initial(
      this.browserState.exportTarget,
      defaultScene
    );
    this._fileName = "";
    this._assets = this.browserState.exportAssets;

    await this.updateComplete;
    await this._dialog.showModal();
  }

  override render(): TemplateResult {
    const blocker = this._target.blocker(this._defaultScene);
    const exportable = blocker === null;

    return html`
      <jolly-dialog
        heading="Export"
        icon="export"
        dismissible
      >
        <jolly-button-group
          layout="tiles"
          aria-label="Export target"
          .options=${this.#targets.options()}
          .value=${this._target.name}
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
        ${this._target.prunesAssets ? html`
          <jolly-checkbox
            label="Include every asset"
            title="Also export the assets no scene uses, for scripts that load assets by ID"
            .value=${this._assets === "all"}
            ?disabled=${!exportable}
            @jolly-change=${this.#onAssetsChange}
          ></jolly-checkbox>
        ` : nothing}
        <jolly-button
          slot="actions"
          variant="accent"
          data-action="export"
          ?disabled=${!exportable}
          @click=${this.#export}
        >Export</jolly-button>
        <jolly-button
          slot="actions"
          data-action="cancel"
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
    this.browserState.exportTarget = target.name;
  }

  #onFileNameInput(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._fileName = event.detail.value;
  }

  #onAssetsChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this._assets = event.detail.value ? "all" : "reachable";
    this.browserState.exportAssets = this._assets;
  }

  #openSettings(
    section: string
  ): void {
    this.#close();
    this.dispatchEvent(new SettingsOpenEvent(section));
  }

  #export(): void {
    this._dialog.close("export");
    this.dispatchEvent(new ExportStartEvent(this._target, {
      fileName: this._fileName,
      assets: this._assets
    }));
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

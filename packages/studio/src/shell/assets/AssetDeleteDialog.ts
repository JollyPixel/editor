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
  query,
  state
} from "lit/decorators.js";
import type {
  Button,
  Dialog
} from "@jolly-pixel/ui";

export interface AssetDeleteRequest {
  name: string;
  folder: boolean;
  assets: string[];
  dependents: string[];
}

@customElement("asset-delete-dialog")
export class AssetDeleteDialog extends LitElement {
  static override styles = css`
    p {
      margin: 0;
    }

    ul {
      margin-block: var(--jolly-space-1, 4px) 0;
      padding-inline-start: var(--jolly-space-4, 16px);
      font-family: ui-monospace, monospace;
    }
  `;

  @state()
  declare _request: AssetDeleteRequest | null;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  @query("jolly-button[data-action=cancel]")
  declare _cancelButton: Button;

  #settle: ((confirmed: boolean) => void) | null = null;

  constructor() {
    super();
    this._request = null;
  }

  async open(
    request: AssetDeleteRequest
  ): Promise<boolean> {
    this.#resolve(false);
    this._request = request;

    const { promise, resolve } = Promise.withResolvers<boolean>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();
    this._cancelButton.focus();

    return promise;
  }

  override render(): TemplateResult {
    const request = this._request;
    const referenced = (request?.dependents.length ?? 0) > 0;

    return html`
      <jolly-dialog
        heading=${headingOf(request)}
        icon="trash"
        intent="danger"
        @jolly-close=${this.#onClose}
      >
        <p>${messageOf(request)}</p>
        ${referenced ? html`
          <ul>${request?.dependents.map((dependent) => html`<li>${dependent}</li>`)}</ul>
        ` : nothing}
        <jolly-button
          slot="actions"
          data-action="cancel"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant="danger"
          data-action="confirm"
          @click=${this.#confirm}
        >${referenced ? "Delete anyway" : "Delete"}</jolly-button>
      </jolly-dialog>
    `;
  }

  #confirm(): void {
    this.#resolve(true);
    this._dialog.close("confirm");
  }

  #cancel(): void {
    this.#resolve(false);
    this._dialog.close("cancel");
  }

  #onClose(): void {
    this.#resolve(false);
  }

  #resolve(
    confirmed: boolean
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(confirmed);
  }
}

function headingOf(
  request: AssetDeleteRequest | null
): string {
  if (request === null) {
    return "";
  }

  return request.folder ?
    `Delete folder "${request.name}"?` :
    `Delete "${request.name}"?`;
}

function messageOf(
  request: AssetDeleteRequest | null
): string {
  if (request === null) {
    return "";
  }

  const scope = request.folder ?
    `${request.assets.length} assets will be deleted.` :
    "This asset will be deleted.";

  return request.dependents.length > 0 ?
    `${scope} These assets still reference it:` :
    `${scope} This cannot be undone.`;
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-delete-dialog": AssetDeleteDialog;
  }
}

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
  Dialog,
  JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";

export interface AssetDeleteConfirmation {
  companions: boolean;
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

    jolly-checkbox {
      margin-block-start: var(--jolly-space-2, 8px);
    }
  `;

  @state()
  declare _deletion: AssetDeletion | null;

  @state()
  declare _companions: boolean;

  @query("jolly-dialog")
  declare _dialog: Dialog;

  @query("jolly-button[data-action=cancel]")
  declare _cancelButton: Button;

  #settle: ((confirmation: AssetDeleteConfirmation | null) => void) | null = null;

  constructor() {
    super();
    this._deletion = null;
    this._companions = true;
  }

  async open(
    deletion: AssetDeletion
  ): Promise<AssetDeleteConfirmation | null> {
    this.#resolve(null);
    this._deletion = deletion;
    this._companions = true;

    const {
      promise,
      resolve
    } = Promise.withResolvers<AssetDeleteConfirmation | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();
    this._cancelButton.focus();

    return promise;
  }

  override render(): TemplateResult {
    const deletion = this._deletion;
    const dependents = deletion?.dependents(this._companions) ?? [];
    const companions = deletion?.companions.map(
      (companion) => companion.path.toString()
    ) ?? [];

    return html`
      <jolly-dialog
        heading=${headingOf(deletion)}
        icon="trash"
        intent="danger"
        @jolly-close=${this.#onClose}
      >
        <p>${messageOf(deletion, dependents)}</p>
        ${dependents.length > 0 ? html`
          <ul>${dependents.map((dependent) => html`<li>${dependent}</li>`)}</ul>
        ` : nothing}
        ${companions.length > 0 ? html`
          <jolly-checkbox
            label=${companionLabelOf(companions)}
            clickable-background
            .value=${this._companions}
            @jolly-change=${this.#onCompanionsChange}
          ></jolly-checkbox>
          <ul>${companions.map((companion) => html`<li>${companion}</li>`)}</ul>
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
        >${dependents.length > 0 ? "Delete anyway" : "Delete"}</jolly-button>
      </jolly-dialog>
    `;
  }

  #onCompanionsChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this._companions = event.detail.value;
  }

  #confirm(): void {
    this.#resolve({
      companions: this._companions
    });
    this._dialog.close("confirm");
  }

  #cancel(): void {
    this.#resolve(null);
    this._dialog.close("cancel");
  }

  #onClose(): void {
    this.#resolve(null);
  }

  #resolve(
    confirmation: AssetDeleteConfirmation | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(confirmation);
  }
}

function headingOf(
  deletion: AssetDeletion | null
): string {
  const [target] = deletion?.targets ?? [];
  if (deletion === null || target === undefined) {
    return "";
  }
  if (deletion.targets.length > 1) {
    return `Delete ${deletion.targets.length} items?`;
  }

  return target.type === "folder" ?
    `Delete folder "${target.path.name}"?` :
    `Delete "${target.path.name}"?`;
}

function messageOf(
  deletion: AssetDeletion | null,
  dependents: readonly string[]
): string {
  if (deletion === null) {
    return "";
  }

  const [target] = deletion.targets;
  const single = deletion.targets.length === 1 && target?.type === "asset";
  const scope = single ?
    "This asset will be deleted." :
    `${deletion.assets.length} assets will be deleted.`;
  if (dependents.length === 0) {
    return `${scope} This cannot be undone.`;
  }

  return single ?
    `${scope} These assets still reference it:` :
    `${scope} These assets still reference them:`;
}

function companionLabelOf(
  companions: readonly string[]
): string {
  return companions.length === 1 ?
    "Also delete its companion" :
    `Also delete ${companions.length} companions`;
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-delete-dialog": AssetDeleteDialog;
  }
}

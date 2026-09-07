// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import type {
  Dialog,
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

export interface MergeLayerContext {
  sourceName: string;
  options: JollyOption<string>[];
  defaultTarget: string;
}

@customElement("merge-layer-dialog")
export class MergeLayerDialog extends LitElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      --jolly-label-width: 70px;
    }

    .hint {
      color: var(--jolly-text-muted, #888);
      font-size: 11px;
      margin: 0;
    }
  `;

  @state()
  private declare _sourceName: string;

  @state()
  private declare _target: string;

  @state()
  private declare _options: JollyOption<string>[];

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #settle: ((target: string | null) => void) | null = null;

  constructor() {
    super();
    this._sourceName = "";
    this._target = "";
    this._options = [];
  }

  async open(
    context: MergeLayerContext
  ): Promise<string | null> {
    this._sourceName = context.sourceName;
    this._options = context.options;
    this._target = context.defaultTarget;

    const { promise, resolve } = Promise.withResolvers<string | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();

    return promise;
  }

  override render() {
    return html`
      <jolly-dialog
        heading="Merge layer"
        @jolly-cancel=${this.#onCancel}
      >
        <div class="fields">
          <jolly-select
            label="Into"
            .options=${this._options}
            .value=${this._target}
            @jolly-change=${this.#onTargetChange}
          ></jolly-select>
          <p class="hint">
            ${this._sourceName} is removed once its voxels are merged.
          </p>
        </div>

        <jolly-button
          slot="actions"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#confirm}
        >Merge</jolly-button>
      </jolly-dialog>
    `;
  }

  #onTargetChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this._target = event.detail.value;
  }

  #confirm(): void {
    this.#resolve(this._target || null);
    this._dialog.close("confirm");
  }

  #cancel(): void {
    this.#resolve(null);
    this._dialog.close("cancel");
  }

  #onCancel(): void {
    this.#resolve(null);
  }

  #resolve(
    target: string | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(target);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "merge-layer-dialog": MergeLayerDialog;
  }
}

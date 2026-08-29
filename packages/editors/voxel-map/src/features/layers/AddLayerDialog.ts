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

// CONSTANTS
const kOptions: JollyOption<AddKind>[] = [
  { value: "voxel-layer", label: "Voxel Layer" },
  { value: "object-layer", label: "Object Layer" },
  { value: "object", label: "Object" }
];

export type AddKind = "voxel-layer" | "object-layer" | "object";

export interface AddLayerContext {
  /** Whether an object layer is available to receive a new object. */
  canAddObject: boolean;
  defaultKind: AddKind;
  defaultName: Record<AddKind, string>;
}

export interface AddLayerResult {
  kind: AddKind;
  name: string;
}

/**
 * Single entry point for everything the layers tree can gain: a voxel
 * layer, an object layer, or an object inside the active object layer.
 *
 * The name field follows the kind until it is edited, so switching kinds
 * never leaves a mismatched default behind.
 */
@customElement("add-layer-dialog")
export class AddLayerDialog extends LitElement {
  static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      --jolly-label-width: 70px;
    }
  `;

  @state()
  private declare _kind: AddKind;
  @state()
  private declare _name: string;
  @state()
  private declare _canAddObject: boolean;

  @query("jolly-dialog")
  private declare _dialog: Dialog;

  #defaultName: Record<AddKind, string> = {
    "voxel-layer": "Layer",
    "object-layer": "Objects",
    object: "Object"
  };
  #nameEdited = false;
  #settle: ((result: AddLayerResult | null) => void) | null = null;

  constructor() {
    super();
    this._kind = "voxel-layer";
    this._name = "";
    this._canAddObject = false;
  }

  /**
   * Opens the modal and resolves with what to create, or null when it is
   * dismissed or the name is left blank.
   */
  async open(
    context: AddLayerContext
  ): Promise<AddLayerResult | null> {
    this.#defaultName = context.defaultName;
    this._canAddObject = context.canAddObject;
    this._kind = context.canAddObject || context.defaultKind !== "object"
      ? context.defaultKind
      : "voxel-layer";
    this._name = this.#defaultName[this._kind];
    this.#nameEdited = false;

    const { promise, resolve } = Promise.withResolvers<AddLayerResult | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this._dialog.showModal();

    return promise;
  }

  override render() {
    return html`
      <jolly-dialog
        heading="New"
        @jolly-cancel=${this.#onCancel}
      >
        <div class="fields">
          <jolly-select
            label="Kind"
            .options=${this.#options()}
            .value=${this._kind}
            @jolly-change=${this.#onKindChange}
          ></jolly-select>
          <jolly-text
            label="Name"
            .value=${this._name}
            @jolly-change=${this.#onNameChange}
          ></jolly-text>
        </div>

        <jolly-button
          slot="actions"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant="accent"
          @click=${this.#confirm}
        >Create</jolly-button>
      </jolly-dialog>
    `;
  }

  #options(): JollyOption<AddKind>[] {
    if (this._canAddObject) {
      return kOptions;
    }

    const options: JollyOption<AddKind>[] = [];
    for (const option of kOptions) {
      options.push(
        option.value === "object"
          ? { ...option, disabled: true }
          : option
      );
    }

    return options;
  }

  #onKindChange(
    event: CustomEvent<JollyChangeDetail<AddKind>>
  ): void {
    this._kind = event.detail.value;
    if (!this.#nameEdited) {
      this._name = this.#defaultName[this._kind];
    }
  }

  #onNameChange(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.#nameEdited = true;
    this._name = event.detail.value;
  }

  #confirm(): void {
    const name = this._name.trim();
    this.#resolve(name ? { kind: this._kind, name } : null);
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
    result: AddLayerResult | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(result);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "add-layer-dialog": AddLayerDialog;
  }
}

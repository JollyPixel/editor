// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";
import {
  DialogRequest,
  type Dialog,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/fields";

// Import Internal Dependencies
import "../layerIcons.ts";

// CONSTANTS
const kOptions: JollyOption<AddKind>[] = [
  { value: "voxel-layer", label: "Voxel" },
  { value: "object-layer", label: "Objects" },
  { value: "object", label: "Object" }
];

export type AddKind = "voxel-layer" | "object-layer" | "object";

export interface AddLayerContext {
  canAddObject: boolean;
  defaultKind: AddKind;
  defaultName: Record<AddKind, string>;
}

export interface AddLayerResult {
  kind: AddKind;
  name: string;
}

@customElement("add-layer-dialog")
export class AddLayerDialog extends LitElement {
  static override styles = css`
    jolly-fields {
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
  #request = new DialogRequest<AddLayerResult>(this, {
    dialog: () => this._dialog
  });

  constructor() {
    super();
    this._kind = "voxel-layer";
    this._name = "";
    this._canAddObject = false;
  }

  open(
    context: AddLayerContext
  ): Promise<AddLayerResult | null> {
    this.#defaultName = context.defaultName;
    this._canAddObject = context.canAddObject;
    this._kind = context.canAddObject || context.defaultKind !== "object"
      ? context.defaultKind
      : "voxel-layer";
    this._name = this.#defaultName[this._kind];
    this.#nameEdited = false;

    return this.#request.open();
  }

  override render() {
    return html`
      <jolly-dialog
        heading="New"
        icon="layers"
      >
        <jolly-fields>
          <jolly-button-group
            label="Kind"
            .options=${this.#options()}
            .value=${this._kind}
            @jolly-change=${this.#onKindChange}
          ></jolly-button-group>
          <jolly-text
            label="Name"
            .value=${this._name}
            @jolly-change=${this.#onNameChange}
          ></jolly-text>
        </jolly-fields>

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
    return this._canAddObject ?
      kOptions :
      kOptions.filter((option) => option.value !== "object");
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
    if (name === "") {
      this.#request.cancel();

      return;
    }

    this.#request.confirm({
      kind: this._kind,
      name
    });
  }

  #cancel(): void {
    this.#request.cancel();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "add-layer-dialog": AddLayerDialog;
  }
}

// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EditorDialog,
  type EditorDialogFrame
} from "./EditorDialog.ts";

// CONSTANTS
const kChildrenLabel = "Delete children too";

export interface DeleteContext {
  heading: string;
  hasChildren: boolean;
  childrenLabel?: string;
  /**
   * What the deletion affects beyond the deleted row.
   */
  message?: string;
}

export interface DeleteResult {
  deleteChildren: boolean;
}

export class DeleteDialog extends EditorDialog<
  DeleteContext,
  DeleteResult
> {
  @state()
  declare private heading: string;

  @state()
  declare private hasChildren: boolean;

  @state()
  declare private deleteChildren: boolean;

  @state()
  declare private childrenLabel: string;

  @state()
  declare private message: string;

  constructor() {
    super();
    this.heading = "";
    this.hasChildren = false;
    this.deleteChildren = true;
    this.childrenLabel = kChildrenLabel;
    this.message = "";
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: this.heading,
      icon: "action-delete",
      intent: "danger",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    };
  }

  protected reset(
    context: DeleteContext
  ): void {
    this.heading = context.heading;
    this.hasChildren = context.hasChildren;
    this.childrenLabel = context.childrenLabel ?? kChildrenLabel;
    this.message = context.message ?? "";
    this.deleteChildren = true;
  }

  protected result(): DeleteResult {
    return {
      deleteChildren: this.hasChildren && this.deleteChildren
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.cancelButton;
  }

  protected renderFields(): TemplateResult {
    return html`
      ${this.message === "" ? nothing : html`<p>${this.message}</p>`}
      ${this.hasChildren ?
        html`
          <jolly-checkbox
            label=${this.childrenLabel}
            .value=${this.deleteChildren}
            @jolly-change=${this.#onDeleteChildren}
          ></jolly-checkbox>
        ` :
        nothing}
    `;
  }

  #onDeleteChildren(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.deleteChildren = event.detail.value;
  }
}

customElements.define("jolly-model-editor-delete-dialog", DeleteDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-delete-dialog": DeleteDialog;
  }
}

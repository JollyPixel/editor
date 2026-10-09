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
  declare private context: DeleteContext;

  @state()
  declare private deleteChildren: boolean;

  constructor() {
    super();
    this.context = {
      heading: "",
      hasChildren: false
    };
    this.deleteChildren = true;
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: this.context.heading,
      icon: "action-delete",
      intent: "danger",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    };
  }

  protected reset(
    context: DeleteContext
  ): void {
    this.context = context;
    this.deleteChildren = true;
  }

  protected result(): DeleteResult {
    return {
      deleteChildren: this.context.hasChildren && this.deleteChildren
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.cancelButton;
  }

  protected renderFields(): TemplateResult {
    const {
      hasChildren,
      childrenLabel = kChildrenLabel,
      message = ""
    } = this.context;

    return html`
      ${message === "" ? nothing : html`<p>${message}</p>`}
      ${hasChildren ?
        html`
          <jolly-checkbox
            label=${childrenLabel}
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

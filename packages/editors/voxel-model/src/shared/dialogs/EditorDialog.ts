// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import {
  DialogRequest,
  type Button,
  type ButtonVariant,
  type Dialog,
  type DialogIntent,
  type IconName
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/dialog";

export interface EditorDialogFrame {
  heading: string;
  icon?: IconName;
  intent?: DialogIntent;
  confirmLabel: string;
  confirmVariant: ButtonVariant;
  confirmDisabled?: boolean;
}

export abstract class EditorDialog<TContext, TResult> extends LitElement {
  @query("jolly-dialog")
  declare private dialogElement: Dialog;

  @query("jolly-button[data-action=confirm]")
  declare protected confirmButton: Button;

  @query("jolly-button[data-action=cancel]")
  declare protected cancelButton: Button;

  #request = new DialogRequest<TResult>(this, {
    dialog: () => this.dialogElement,
    focus: () => this.focusTarget()
  });

  protected abstract get frame(): EditorDialogFrame;

  protected abstract reset(
    context: TContext
  ): void;

  protected abstract result(): TResult;

  protected abstract renderFields(): unknown;

  protected abstract focusTarget(): HTMLElement | null;

  protected canConfirm(): boolean {
    return this.frame.confirmDisabled !== true;
  }

  open(
    context: TContext
  ): Promise<TResult | null> {
    this.reset(context);

    return this.#request.open();
  }

  override render(): TemplateResult {
    const {
      heading,
      icon = "",
      intent = "",
      confirmLabel,
      confirmVariant,
      confirmDisabled = false
    } = this.frame;

    return html`
      <jolly-dialog
        heading=${heading}
        icon=${icon}
        intent=${intent}
      >
        ${this.renderFields()}
        <jolly-button
          slot="actions"
          data-action="cancel"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        <jolly-button
          slot="actions"
          variant=${confirmVariant}
          data-action="confirm"
          ?disabled=${confirmDisabled}
          @click=${this.#confirm}
        >${confirmLabel}</jolly-button>
      </jolly-dialog>
    `;
  }

  #confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.#request.confirm(this.result());
  }

  #cancel(): void {
    this.#request.cancel();
  }
}

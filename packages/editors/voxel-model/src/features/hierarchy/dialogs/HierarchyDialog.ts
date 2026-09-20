// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import type {
  Button,
  ButtonVariant,
  Dialog,
  DialogIntent,
  IconName
} from "@jolly-pixel/ui";

export interface HierarchyDialogFrame {
  heading: string;
  icon?: IconName;
  intent?: DialogIntent;
  confirmLabel: string;
  confirmVariant: ButtonVariant;
}

export abstract class HierarchyDialog<TContext, TResult> extends LitElement {
  @query("jolly-dialog")
  declare private dialogElement: Dialog;

  @query("jolly-button[data-action=confirm]")
  declare protected confirmButton: Button;

  @query("jolly-button[data-action=cancel]")
  declare protected cancelButton: Button;

  #settle: ((result: TResult | null) => void) | null = null;

  protected abstract get frame(): HierarchyDialogFrame;

  protected abstract reset(
    context: TContext
  ): void;

  protected abstract result(): TResult;

  protected abstract renderFields(): unknown;

  protected abstract focusTarget(): HTMLElement | null;

  async open(
    context: TContext
  ): Promise<TResult | null> {
    this.#resolve(null);
    this.reset(context);

    const { promise, resolve } = Promise.withResolvers<TResult | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this.dialogElement.showModal();
    this.focusTarget()?.focus();

    return promise;
  }

  override render(): TemplateResult {
    const {
      heading,
      icon = "",
      intent = "",
      confirmLabel,
      confirmVariant
    } = this.frame;

    return html`
      <jolly-dialog
        heading=${heading}
        icon=${icon}
        intent=${intent}
        @jolly-close=${this.#onClose}
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
          @click=${this.#confirm}
        >${confirmLabel}</jolly-button>
      </jolly-dialog>
    `;
  }

  #confirm(): void {
    this.#resolve(this.result());
    this.dialogElement.close("confirm");
  }

  #cancel(): void {
    this.#resolve(null);
    this.dialogElement.close("cancel");
  }

  #onClose(): void {
    this.#resolve(null);
  }

  #resolve(
    result: TResult | null
  ): void {
    const settle = this.#settle;
    this.#settle = null;
    settle?.(result);
  }
}

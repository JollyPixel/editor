// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import type {
  ButtonVariant,
  Dialog,
  DialogIntent,
  IconName
} from "@jolly-pixel/ui";

export interface TextureDialogAction<TAction extends string> {
  value: TAction;
  label: string;
  variant: ButtonVariant;
}

export interface TextureDialogFrame<TAction extends string> {
  heading: string;
  icon: IconName;
  intent?: DialogIntent;
  message: string;
  actions: readonly TextureDialogAction<TAction>[];
  focus: TAction;
}

export abstract class TextureDialog<
  TContext,
  TAction extends string,
  TResult
> extends LitElement {
  @query("jolly-dialog")
  declare private dialogElement: Dialog;

  #settle: ((result: TResult | null) => void) | null = null;

  protected abstract get frame(): TextureDialogFrame<TAction>;

  protected abstract reset(
    context: TContext
  ): void;

  protected abstract result(
    action: TAction
  ): TResult;

  protected abstract renderFields(): unknown;

  async open(
    context: TContext
  ): Promise<TResult | null> {
    this.#resolve(null);
    this.reset(context);

    const { promise, resolve } = Promise.withResolvers<TResult | null>();
    this.#settle = resolve;

    await this.updateComplete;
    await this.dialogElement.showModal();
    this.renderRoot
      .querySelector<HTMLElement>(`[data-action="${this.frame.focus}"]`)
      ?.focus();

    return promise;
  }

  override render(): TemplateResult {
    const {
      heading,
      icon,
      intent = "",
      message,
      actions
    } = this.frame;

    return html`
      <jolly-dialog
        heading=${heading}
        icon=${icon}
        intent=${intent}
        @jolly-close=${this.#onClose}
      >
        <p>${message}</p>
        ${this.renderFields()}
        <jolly-button
          slot="actions"
          data-action="cancel"
          @click=${this.#cancel}
        >Cancel</jolly-button>
        ${actions.map((action) => html`
          <jolly-button
            slot="actions"
            variant=${action.variant}
            data-action=${action.value}
            @click=${() => this.#confirm(action.value)}
          >${action.label}</jolly-button>
        `)}
      </jolly-dialog>
    `;
  }

  #confirm(
    action: TAction
  ): void {
    this.#resolve(this.result(action));
    this.dialogElement.close(action);
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

// Import Third-party Dependencies
import {
  LitElement,
  html,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import {
  DialogRequest,
  type ButtonVariant,
  type Dialog,
  type DialogIntent,
  type IconName
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/dialog";

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

  #request = new DialogRequest<TResult>(this, {
    dialog: () => this.dialogElement,
    focus: () => this.renderRoot.querySelector<HTMLElement>(
      `[data-action="${this.frame.focus}"]`
    )
  });

  protected abstract get frame(): TextureDialogFrame<TAction>;

  protected abstract reset(
    context: TContext
  ): void;

  protected abstract result(
    action: TAction
  ): TResult;

  protected abstract renderFields(): unknown;

  open(
    context: TContext
  ): Promise<TResult | null> {
    this.reset(context);

    return this.#request.open();
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
    this.#request.confirm(this.result(action), action);
  }

  #cancel(): void {
    this.#request.cancel();
  }
}

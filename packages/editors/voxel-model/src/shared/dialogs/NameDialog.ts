// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { state } from "lit/decorators.js";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EditorDialog,
  type EditorDialogFrame
} from "./EditorDialog.ts";
import {
  NameDraft,
  type NameFieldOptions
} from "./NameDraft.ts";

export interface NameDialogChoice {
  label: string;
  options: readonly JollyOption<string>[];
  value: string;
}

export interface NameDialogContext extends NameFieldOptions {
  heading: string;
  fieldLabel: string;
  /**
   * A pick shown under the name, such as a block's shape.
   */
  choice?: NameDialogChoice;
}

export interface NameDialogResult {
  name: string;
  /**
   * The value picked, when the dialog was opened with a `choice`.
   */
  choice?: string;
}

export class NameDialog extends EditorDialog<
  NameDialogContext,
  NameDialogResult
> {
  @state()
  declare private context: NameDialogContext;

  @state()
  declare private draft: NameDraft;

  @state()
  declare private choice: string | null;

  constructor() {
    super();
    this.context = {
      heading: "",
      fieldLabel: "",
      defaultName: ""
    };
    this.draft = NameDraft.from(this.context);
    this.choice = null;
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: this.context.heading,
      confirmLabel: "OK",
      confirmVariant: "accent",
      confirmDisabled: this.draft.error !== null
    };
  }

  protected reset(
    context: NameDialogContext
  ): void {
    this.context = context;
    this.draft = NameDraft.from(context);
    this.choice = context.choice?.value ?? null;
  }

  protected override canConfirm(): boolean {
    this.draft = this.draft.revalidate();

    return this.draft.error === null;
  }

  protected result(): NameDialogResult {
    return {
      name: this.draft.name,
      ...this.choice === null ? {} : { choice: this.choice }
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.renderRoot.querySelector("jolly-text");
  }

  protected renderFields(): TemplateResult {
    return html`
      <jolly-text
        label=${this.context.fieldLabel}
        .value=${this.draft.text}
        .error=${this.draft.error}
        @jolly-input=${this.#onName}
        @jolly-change=${this.#onName}
      ></jolly-text>
      ${this.context.choice === undefined ?
        nothing :
        html`
          <jolly-button-group
            icon-only
            aria-label=${this.context.choice.label}
            .options=${this.context.choice.options}
            .value=${this.choice}
            @jolly-change=${this.#onChoice}
          ></jolly-button-group>
        `}
    `;
  }

  #onChoice(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.choice = event.detail.value;
  }

  #onName(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.draft = this.draft.edit(event.detail.value);
  }
}

customElements.define("jolly-model-editor-name-dialog", NameDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-name-dialog": NameDialog;
  }
}

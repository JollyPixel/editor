// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import { state } from "lit/decorators.js";
import type { JollyChangeDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EditorDialog,
  type EditorDialogFrame
} from "./EditorDialog.ts";
import {
  NameDraft,
  type NameFieldOptions
} from "./NameDraft.ts";

export interface NameDialogContext extends NameFieldOptions {
  heading: string;
  fieldLabel: string;
}

export interface NameDialogResult {
  name: string;
}

export class NameDialog extends EditorDialog<
  NameDialogContext,
  NameDialogResult
> {
  @state()
  declare private heading: string;

  @state()
  declare private fieldLabel: string;

  @state()
  declare private draft: NameDraft;

  constructor() {
    super();
    this.heading = "";
    this.fieldLabel = "";
    this.draft = new NameDraft("");
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: this.heading,
      confirmLabel: "OK",
      confirmVariant: "accent",
      confirmDisabled: this.draft.error !== null
    };
  }

  protected reset(
    context: NameDialogContext
  ): void {
    this.heading = context.heading;
    this.fieldLabel = context.fieldLabel;
    this.draft = NameDraft.from(context);
  }

  protected result(): NameDialogResult {
    return {
      name: this.draft.name
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.renderRoot.querySelector("jolly-text");
  }

  protected renderFields(): TemplateResult {
    return html`
      <jolly-text
        label=${this.fieldLabel}
        .value=${this.draft.text}
        .error=${this.draft.error}
        @jolly-input=${this.#onName}
        @jolly-change=${this.#onName}
      ></jolly-text>
    `;
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

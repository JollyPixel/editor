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
} from "../../../shared/EditorDialog.ts";

export interface HierarchyNameContext {
  heading: string;
  fieldLabel: string;
  defaultName: string;
}

export interface HierarchyNameResult {
  name: string;
}

export class HierarchyNameDialog extends EditorDialog<
  HierarchyNameContext,
  HierarchyNameResult
> {
  @state()
  declare private heading: string;

  @state()
  declare private fieldLabel: string;

  @state()
  declare private name: string;

  constructor() {
    super();
    this.heading = "";
    this.fieldLabel = "";
    this.name = "";
  }

  protected get frame(): EditorDialogFrame {
    return {
      heading: this.heading,
      confirmLabel: "OK",
      confirmVariant: "accent"
    };
  }

  protected reset(
    context: HierarchyNameContext
  ): void {
    this.heading = context.heading;
    this.fieldLabel = context.fieldLabel;
    this.name = context.defaultName;
  }

  protected result(): HierarchyNameResult {
    return {
      name: this.name.trim()
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.renderRoot.querySelector("jolly-text");
  }

  protected renderFields(): TemplateResult {
    return html`
      <jolly-text
        label=${this.fieldLabel}
        .value=${this.name}
        @jolly-input=${this.#onName}
        @jolly-change=${this.#onName}
      ></jolly-text>
    `;
  }

  #onName(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.name = event.detail.value;
  }
}

customElements.define("jolly-model-editor-name-dialog", HierarchyNameDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-name-dialog": HierarchyNameDialog;
  }
}

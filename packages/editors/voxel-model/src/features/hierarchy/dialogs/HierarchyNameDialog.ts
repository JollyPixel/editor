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
  HierarchyDialog,
  type HierarchyDialogFrame
} from "./HierarchyDialog.ts";

export interface HierarchyNameContext {
  heading: string;
  fieldLabel: string;
  defaultName: string;
  offerAddAsChild: boolean;
}

export interface HierarchyNameResult {
  name: string;
  addAsChild: boolean;
}

export class HierarchyNameDialog extends HierarchyDialog<
  HierarchyNameContext,
  HierarchyNameResult
> {
  @state()
  declare private heading: string;

  @state()
  declare private fieldLabel: string;

  @state()
  declare private name: string;

  @state()
  declare private offerAddAsChild: boolean;

  @state()
  declare private addAsChild: boolean;

  constructor() {
    super();
    this.heading = "";
    this.fieldLabel = "";
    this.name = "";
    this.offerAddAsChild = false;
    this.addAsChild = true;
  }

  protected get frame(): HierarchyDialogFrame {
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
    this.offerAddAsChild = context.offerAddAsChild;
    this.addAsChild = true;
  }

  protected result(): HierarchyNameResult {
    return {
      name: this.name.trim(),
      addAsChild: this.offerAddAsChild && this.addAsChild
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
      ${this.offerAddAsChild ? html`
        <jolly-checkbox
          label="Add as child of selection"
          .value=${this.addAsChild}
          @jolly-change=${this.#onAddAsChild}
        ></jolly-checkbox>
      ` : nothing}
    `;
  }

  #onName(
    event: CustomEvent<JollyChangeDetail<string>>
  ): void {
    this.name = event.detail.value;
  }

  #onAddAsChild(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.addAsChild = event.detail.value;
  }
}

customElements.define("jolly-model-editor-name-dialog", HierarchyNameDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-name-dialog": HierarchyNameDialog;
  }
}

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

export interface HierarchyDeleteContext {
  heading: string;
  hasChildren: boolean;
}

export interface HierarchyDeleteResult {
  deleteChildren: boolean;
}

export class HierarchyDeleteDialog extends HierarchyDialog<
  HierarchyDeleteContext,
  HierarchyDeleteResult
> {
  @state()
  declare private heading: string;

  @state()
  declare private hasChildren: boolean;

  @state()
  declare private deleteChildren: boolean;

  constructor() {
    super();
    this.heading = "";
    this.hasChildren = false;
    this.deleteChildren = true;
  }

  protected get frame(): HierarchyDialogFrame {
    return {
      heading: this.heading,
      icon: "block-delete",
      intent: "danger",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    };
  }

  protected reset(
    context: HierarchyDeleteContext
  ): void {
    this.heading = context.heading;
    this.hasChildren = context.hasChildren;
    this.deleteChildren = true;
  }

  protected result(): HierarchyDeleteResult {
    return {
      deleteChildren: this.hasChildren && this.deleteChildren
    };
  }

  protected focusTarget(): HTMLElement | null {
    return this.cancelButton;
  }

  protected renderFields(): TemplateResult | typeof nothing {
    if (!this.hasChildren) {
      return nothing;
    }

    return html`
      <jolly-checkbox
        label="Delete children too"
        .value=${this.deleteChildren}
        @jolly-change=${this.#onDeleteChildren}
      ></jolly-checkbox>
    `;
  }

  #onDeleteChildren(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this.deleteChildren = event.detail.value;
  }
}

customElements.define("jolly-model-editor-delete-dialog", HierarchyDeleteDialog);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-delete-dialog": HierarchyDeleteDialog;
  }
}

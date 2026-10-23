// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  property,
  query
} from "lit/decorators.js";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import "../features/transform/TransformPanel.ts";
import type { TransformPanel } from "../features/transform/TransformPanel.ts";
import type { TransformEditing } from "../features/transform/TransformPanelController.ts";
import "../features/transform/ShapeField.ts";
import type {
  ShapeField,
  ShapeFieldEditing
} from "../features/transform/ShapeField.ts";

export interface BuildEditing extends TransformEditing, ShapeFieldEditing {
  document: ModelDocument;
}

export class BuildTab extends LitElement {
  @property({ attribute: false })
  declare editing: BuildEditing | null;

  @query("jolly-model-editor-transform")
  declare private transformElement: TransformPanel;

  @query("jolly-model-editor-shape")
  declare private shapeElement: ShapeField;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: var(--jolly-row-gap, 4px);
    }

    :host([hidden]) {
      display: none;
    }
  `;

  constructor() {
    super();
    this.editing = null;
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("editing") && this.editing !== null) {
      this.transformElement.attach(this.editing);
      this.shapeElement.attach(this.editing);
    }
  }

  override render(): TemplateResult {
    return html`
      <jolly-model-editor-transform></jolly-model-editor-transform>
      <jolly-model-editor-shape></jolly-model-editor-shape>
    `;
  }
}

customElements.define("jolly-model-editor-build", BuildTab);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-build": BuildTab;
  }
}

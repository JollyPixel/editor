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
import type { TransformWorkspace } from "../features/transform/TransformPanelController.ts";
import "../features/transform/ShapeField.ts";
import type {
  ShapeField,
  ShapeFieldWorkspace
} from "../features/transform/ShapeField.ts";

export interface BuildWorkspace extends TransformWorkspace, ShapeFieldWorkspace {
  document: ModelDocument;
}

export class BuildTab extends LitElement {
  @property({ attribute: false })
  declare workspace: BuildWorkspace | null;

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
    this.workspace = null;
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("workspace") && this.workspace !== null) {
      this.transformElement.attach(this.workspace);
      this.shapeElement.attach(this.workspace);
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

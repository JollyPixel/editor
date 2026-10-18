// Import Third-party Dependencies
import {
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { LayerTemplateDrop } from "../../features/templates/LayerTemplateDrop.ts";
import type { TemplateManager } from "../../features/templates/TemplateManager.ts";
import "../../features/layers/LayerManager.ts";
import "../../features/templates/TemplateManager.ts";
import "../../features/templates/TemplatePreview.ts";

@customElement("layers-panel")
export class LayersPanel extends WorkspaceElement {
  static override styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      container-type: size;

      --jolly-folder-indent: 0;
      --jolly-field-inset-end: 0;
    }

    .managers {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }

    template-preview {
      flex: 0 0 auto;
    }
  `;

  @query("template-manager")
  private declare _templates: TemplateManager | null;

  readonly #templateDrop = new LayerTemplateDrop({
    zone: {
      bounds: () => this._templates?.getBoundingClientRect() ?? null,
      highlight: (active) => {
        if (this._templates !== null) {
          this._templates.dropTarget = active;
        }
      }
    },
    editable: () => this.workspace?.templates.editable === true,
    save: (layerName) => this.workspace?.templates.saveLayer(layerName)
  });

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    return html`
      <div class="managers">
        <layer-manager
          .workspace=${workspace}
          .dragOut=${this.#templateDrop}
        ></layer-manager>
        <template-manager .workspace=${workspace}></template-manager>
      </div>
      <template-preview .workspace=${workspace}></template-preview>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layers-panel": LayersPanel;
  }
}

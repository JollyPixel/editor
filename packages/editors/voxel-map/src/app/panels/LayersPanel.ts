// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import "../../features/layers/LayerManager.ts";
import "../../features/templates/TemplateManager.ts";

@customElement("layers-panel")
export class LayersPanel extends WorkspaceElement {
  static override styles = css`
    :host {
      display: block;

      --jolly-folder-indent: 0;
      --jolly-field-inset-end: 0;
    }
  `;

  override render() {
    const workspace = this.workspace;
    if (workspace === null) {
      return nothing;
    }

    return html`
      <layer-manager .workspace=${workspace}></layer-manager>
      <template-manager .workspace=${workspace}></template-manager>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "layers-panel": LayersPanel;
  }
}

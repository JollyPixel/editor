// Import Third-party Dependencies
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("texture-editor-placeholder")
export class TextureEditorPlaceholder extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      padding: 24px 12px;
      color: #555;
      font-size: 13px;
      border: 1px dashed #2a3540;
      margin: 8px;
      border-radius: 6px;
    }

    .icon {
      font-size: 28px;
      opacity: 0.4;
    }
    .label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .sub {
      font-size: 11px;
      color: #444;
    }
  `;

  override render() {
    return html`
      <div class="icon">[TX]</div>
      <div class="label">Texture Editor</div>
      <div class="sub">Coming in a future release</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "texture-editor-placeholder": TextureEditorPlaceholder;
  }
}

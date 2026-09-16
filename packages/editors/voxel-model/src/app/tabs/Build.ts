// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import { type JollyChangeDetail, type JollyOption } from "@jolly-pixel/ui";
import { type PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kTextureSizeValues = [16, 32, 64, 128, 256, 512, 1024, 2048];
const kTextureSizeOptions: JollyOption<number>[] = kTextureSizeValues.map((value) => {
  return { value, label: String(value) };
});

export class Build extends LitElement {
  @state()
  private declare textureSize: { x: number; y: number; };

  #hasSyncedTextureSize = false;

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

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    jolly-property-row jolly-select {
      flex: 1 1 0;
      min-width: 0;

      --jolly-field-inset-end: 0;
    }

    .separator {
      color: var(--jolly-text-muted);
    }
  `;

  constructor() {
    super();
    this.textureSize = { x: 64, y: 64 };
  }

  override updated(): void {
    if (this.#hasSyncedTextureSize) {
      return;
    }

    const manager = this.#getPixelArtCanvas();
    if (!manager) {
      return;
    }

    this.textureSize = { ...manager.textureSize };
    this.#hasSyncedTextureSize = true;
  }

  #getLeftPanel(): any {
    const rootNode = this.getRootNode() as ShadowRoot;

    return rootNode?.host;
  }

  #getPixelArtCanvas(): PixelArtCanvas | null {
    const leftPanel = this.#getLeftPanel();

    return leftPanel?.canvasManager ?? null;
  }

  #handleTextureSizeChange(
    axis: "x" | "y",
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    const manager = this.#getPixelArtCanvas();
    if (!manager) {
      return;
    }

    this.textureSize = {
      ...this.textureSize,
      [axis]: event.detail.value
    };
    manager.textureSize = this.textureSize;
  }

  override render() {
    return html`
      <section id="texture">
        <jolly-property-row label="Texture">
          <jolly-select
            title="Width"
            .options=${kTextureSizeOptions}
            .value=${this.textureSize.x}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#handleTextureSizeChange("x", event);
            }}
          ></jolly-select>
          <span class="separator">×</span>
          <jolly-select
            title="Height"
            .options=${kTextureSizeOptions}
            .value=${this.textureSize.y}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#handleTextureSizeChange("y", event);
            }}
          ></jolly-select>
        </jolly-property-row>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-build", Build);

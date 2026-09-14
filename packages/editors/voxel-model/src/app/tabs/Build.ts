// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import { type JollyChangeDetail, type JollyOption } from "@jolly-pixel/ui";
import { type PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { GizmoSpace, ModelSceneComponent } from "../ModelSceneComponent.ts";
import {
  TransformPanelController,
  type TransformMode,
  type Vector3Value
} from "../../features/transform/TransformPanelController.ts";

// CONSTANTS
const kTransformModes: JollyOption<TransformMode>[] = [
  { value: "pos", label: "Pos" },
  { value: "angle", label: "Angle" },
  { value: "size", label: "Size" },
  { value: "pivot", label: "Pivot" },
  { value: "scale", label: "Scale" }
];

const kSpaceOptions: JollyOption<GizmoSpace>[] = [
  { value: "local", label: "Local" },
  { value: "world", label: "Global" }
];

const kSpaceModes: readonly TransformMode[] = ["pos", "angle", "pivot"];

const kTextureSizeValues = [16, 32, 64, 128, 256, 512, 1024, 2048];
const kTextureSizeOptions: JollyOption<number>[] = kTextureSizeValues.map((value) => {
  return { value, label: String(value) };
});

export class Build extends LitElement {
  @state()
  private declare textureSize: { x: number; y: number; };

  #transform = new TransformPanelController(this);
  #hasSyncedTextureSize = false;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: var(--jolly-space-3, 12px);
      box-sizing: border-box;
      padding: var(--jolly-space-2, 8px);
    }

    :host([hidden]) {
      display: none;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2, 8px);
    }

    jolly-vector3 {
      max-width: 100%;
    }

    jolly-property-row jolly-select {
      flex: 1 1 0;
      min-width: 0;
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

  public setSceneManager(sceneManager: ModelSceneComponent): void {
    this.#transform.attach(sceneManager);
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
      <section id="transform">
        <jolly-button-group
          .options=${kTransformModes}
          .value=${this.#transform.mode}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<TransformMode>>) => {
            this.#transform.setMode(event.detail.value);
          }}
        ></jolly-button-group>

        <jolly-button-group
          .options=${kSpaceOptions}
          .value=${this.#transform.space}
          ?disabled=${this.#transform.disabled || !kSpaceModes.includes(this.#transform.mode)}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<GizmoSpace>>) => {
            this.#transform.setSpace(event.detail.value);
          }}
        ></jolly-button-group>

        <jolly-vector3
          step="0.01"
          ?disabled=${this.#transform.disabled}
          .value=${this.#transform.axisValues}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vector3Value>>) => {
            this.#transform.setAxisValues(event.detail.value);
          }}
        ></jolly-vector3>
      </section>

      <section id="texture">
        <jolly-property-row label="Texture">
          <jolly-select
            label="W"
            .options=${kTextureSizeOptions}
            .value=${this.textureSize.x}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#handleTextureSizeChange("x", event);
            }}
          ></jolly-select>
          <jolly-select
            label="H"
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

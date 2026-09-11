// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { state } from "lit/decorators.js";
import * as THREE from "three";
import { type JollyChangeDetail, type JollyOption } from "@jolly-pixel/ui";
import { type PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type GroupManager from "../../three/GroupManager.ts";

// CONSTANTS
type TransformMode = "pos" | "angle" | "size" | "pivot" | "scale";
type Vector3Value = { x: number; y: number; z: number; };

const kTransformModes: JollyOption<TransformMode>[] = [
  { value: "pos", label: "Pos" },
  { value: "angle", label: "Angle" },
  { value: "size", label: "Size" },
  { value: "pivot", label: "Pivot" },
  { value: "scale", label: "Scale" }
];

const kTextureSizeValues = [16, 32, 64, 128, 256, 512, 1024, 2048];
const kTextureSizeOptions: JollyOption<number>[] = kTextureSizeValues.map((value) => {
  return { value, label: String(value) };
});

export class Build extends LitElement {
  @state()
  private declare mode: TransformMode;

  @state()
  private declare axisValues: Vector3Value;

  @state()
  private declare textureSize: { x: number; y: number; };

  #selectedGroup: GroupManager | null = null;
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
    this.mode = "pos";
    this.axisValues = { x: 0, y: 0, z: 0 };
    this.textureSize = { x: 64, y: 64 };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("groupSelected", this.#onGroupSelected);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("groupSelected", this.#onGroupSelected);
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

  readonly #onGroupSelected = (
    event: Event
  ): void => {
    const { group } = (event as CustomEvent<{ group: GroupManager | null; }>).detail;
    this.#selectedGroup = group;
    this.#syncAxisValues();
  };

  #syncAxisValues(): void {
    if (!this.#selectedGroup) {
      return;
    }

    this.axisValues = this.#readAxisValues(this.#selectedGroup, this.mode);
  }

  #readAxisValues(
    group: GroupManager,
    mode: TransformMode
  ): Vector3Value {
    switch (mode) {
      case "pos":
        return group.getPosition();
      case "angle": {
        const rotation = group.getRotation();

        return {
          x: THREE.MathUtils.radToDeg(rotation.x),
          y: THREE.MathUtils.radToDeg(rotation.y),
          z: THREE.MathUtils.radToDeg(rotation.z)
        };
      }
      case "size":
        return group.getSize();
      case "pivot":
        return group.getPivotOffset();
      case "scale":
        return group.getScale();
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  #handleModeChange(
    event: CustomEvent<JollyChangeDetail<TransformMode>>
  ): void {
    this.mode = event.detail.value;
    this.#syncAxisValues();
  }

  #handleVectorChange(
    event: CustomEvent<JollyChangeDetail<Vector3Value>>
  ): void {
    this.axisValues = event.detail.value;
    this.#applyAxisValues();
  }

  #applyAxisValues(): void {
    if (!this.#selectedGroup) {
      return;
    }

    const { x, y, z } = this.axisValues;

    switch (this.mode) {
      case "pos":
        this.#selectedGroup.setPosition(new THREE.Vector3(x, y, z));
        break;
      case "angle":
        this.#selectedGroup.setRotation(new THREE.Euler(
          THREE.MathUtils.degToRad(x),
          THREE.MathUtils.degToRad(y),
          THREE.MathUtils.degToRad(z)
        ));
        break;
      case "size":
        this.#selectedGroup.resize(new THREE.Vector3(x, y, z));
        break;
      case "pivot":
        this.#selectedGroup.setPivotOffset(new THREE.Vector3(x, y, z));
        break;
      case "scale":
        this.#selectedGroup.setScale(new THREE.Vector3(x, y, z));
        break;
      default:
        break;
    }
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
    const disabled = this.#selectedGroup === null;

    return html`
      <section id="transform">
        <jolly-button-group
          .options=${kTransformModes}
          .value=${this.mode}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<TransformMode>>) => {
            this.#handleModeChange(event);
          }}
        ></jolly-button-group>

        <jolly-vector3
          step="0.1"
          ?disabled=${disabled}
          .value=${this.axisValues}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<Vector3Value>>) => {
            this.#handleVectorChange(event);
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

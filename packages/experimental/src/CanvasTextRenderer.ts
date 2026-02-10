// Import Third-party Dependencies
import * as THREE from "three";

export interface CanvasTextRendererOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  text: string;
  backgroundColor: number;
  textColor: string;
  fontSize: number;
}

export class CanvasTextRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;

  #options: CanvasTextRendererOptions;

  constructor(options: CanvasTextRendererOptions) {
    this.#options = {
      canvasWidth: 512,
      canvasHeight: 128,
      ...options
    };

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.#options.canvasWidth!;
    this.canvas.height = this.#options.canvasHeight!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  render(overrides?: Partial<Pick<CanvasTextRendererOptions, "backgroundColor" | "text">>): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { canvasWidth, canvasHeight } = this.#options;
    const backgroundColor = overrides?.backgroundColor ?? this.#options.backgroundColor;
    const text = overrides?.text ?? this.#options.text;

    ctx.clearRect(0, 0, canvasWidth!, canvasHeight!);

    ctx.fillStyle = `#${backgroundColor.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, canvasWidth!, canvasHeight!);

    ctx.fillStyle = this.#options.textColor;
    ctx.font = `${this.#options.fontSize * 2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      text,
      canvasWidth! / 2,
      canvasHeight! / 2
    );

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

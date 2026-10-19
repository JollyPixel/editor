// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Canvas2D,
  createCanvas2D
} from "./Canvas2D.ts";

export interface CanvasSpriteOptions {
  /**
   * Canvas width in pixels.
   */
  width: number;
  /**
   * Canvas height in pixels.
   */
  height: number;
  /**
   * Sprite width in world units; the height follows the canvas ratio.
   */
  worldWidth: number;
  renderOrder: number;
}

export abstract class CanvasSprite extends THREE.Sprite {
  #canvas: Canvas2D;
  #texture: THREE.CanvasTexture;
  #disposed = false;

  constructor(
    options: CanvasSpriteOptions
  ) {
    const { width, height, worldWidth, renderOrder } = options;

    const canvas = createCanvas2D(width, height);
    const texture = new THREE.CanvasTexture(canvas.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    super(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true
      })
    );

    this.#canvas = canvas;
    this.#texture = texture;
    this.scale.set(
      worldWidth,
      worldWidth * (height / width),
      1
    );
    this.renderOrder = renderOrder;
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#texture.dispose();
    this.material.dispose();
  }

  protected redraw(): void {
    const { context, canvas } = this.#canvas;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);
    this.paint(context, width, height);
    this.#texture.needsUpdate = true;
  }

  protected abstract paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void;
}

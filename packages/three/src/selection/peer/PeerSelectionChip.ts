// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type Canvas2D, createCanvas2D } from "../../common/Canvas2D.ts";

// CONSTANTS
const kChipCanvasSize = 64;
const kChipWorldSize = 0.3;
const kChipRadius = kChipCanvasSize * 0.4;
const kChipStrokeWidth = kChipCanvasSize * 0.08;
const kChipLabelFont = `700 ${kChipCanvasSize * 0.36}px sans-serif`;

export interface PeerSelectionChipOptions {
  /**
   * The selecting peer's own color (same source `PeerSelectionOverlays`/
   * `PeerHighlightPass` read via `PeerSelectionRegistry.colorOf`), or a
   * neutral background fill for an overflow badge.
   */
  color: THREE.ColorRepresentation;
  /**
   * Short text (e.g. `"+3"`) drawn centered on the chip instead of a plain
   * filled circle - used by `PeerSelectionChips`' overflow badge. Not a
   * general nameplate: keep it short (a count, not a name).
   */
  label?: string;
}

/**
 * A single small filled-circle billboard, one per simultaneous selector on
 * an object (or one overflow badge summarizing several) -
 * `PeerSelectionChips` lays several of these out in a row above a
 * multi-selected target.
 */
export class PeerSelectionChip extends THREE.Sprite {
  #color: THREE.ColorRepresentation;
  #label: string | undefined;
  #canvas: Canvas2D;
  #texture: THREE.CanvasTexture;

  constructor(
    options: PeerSelectionChipOptions
  ) {
    const canvas = createCanvas2D(kChipCanvasSize, kChipCanvasSize);
    const texture = new THREE.CanvasTexture(canvas.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });
    super(material);

    this.#color = options.color;
    this.#label = options.label;
    this.#canvas = canvas;
    this.#texture = texture;

    this.scale.set(kChipWorldSize, kChipWorldSize, 1);
    this.renderOrder = 1;

    this.#draw();
  }

  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color = color;
    this.#draw();
  }

  get label(): string | undefined {
    return this.#label;
  }

  set label(
    label: string | undefined
  ) {
    this.#label = label;
    this.#draw();
  }

  dispose(): void {
    this.#texture.dispose();
    this.material.dispose();
  }

  #draw(): void {
    const { context, canvas } = this.#canvas;
    const center = canvas.width / 2;

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.beginPath();
    context.arc(center, center, kChipRadius, 0, Math.PI * 2);
    context.fillStyle = new THREE.Color(this.#color).getStyle();
    context.fill();

    // Dark stroke, not the peer's own color, so the chip reads against a
    // background close to its own color too (e.g. two peers with similar
    // hues sitting side by side).
    context.lineWidth = kChipStrokeWidth;
    context.strokeStyle = "rgba(20, 20, 20, 0.85)";
    context.stroke();

    if (this.#label !== undefined) {
      context.font = kChipLabelFont;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#ffffff";
      context.fillText(this.#label, center, center);
    }

    this.#texture.needsUpdate = true;
  }
}

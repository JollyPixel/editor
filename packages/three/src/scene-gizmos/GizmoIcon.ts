// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { CanvasSprite } from "../common/texture/CanvasSprite.ts";

// CONSTANTS
const kCanvasSize = 64;
const kRenderOrder = 2;
const kSize = 0.045;
const kHaloColor = "rgba(10, 12, 16, 0.7)";
const kHaloWidth = 9;
const kGlyphColor = "#ffffff";
const kGlyphWidth = 4;
const kTurn = Math.PI * 2;

export type GizmoIconGlyph =
  | "camera"
  | "point"
  | "spot"
  | "directional"
  | "hemisphere"
  | "ambient";

type GlyphTrace = (context: CanvasRenderingContext2D) => void;

const kGlyphs: Record<GizmoIconGlyph, GlyphTrace> = {
  camera(context) {
    context.moveTo(8, 24);
    context.lineTo(40, 24);
    context.lineTo(40, 48);
    context.lineTo(8, 48);
    context.closePath();
    context.moveTo(40, 32);
    context.lineTo(56, 24);
    context.lineTo(56, 48);
    context.lineTo(40, 40);
    circle(context, 16, 14, 6);
    circle(context, 32, 14, 6);
  },
  point(context) {
    const bulbOffset = 14 * Math.SQRT1_2;

    context.moveTo(32 - bulbOffset, 25 + bulbOffset);
    context.arc(32, 25, 14, kTurn * 0.375, kTurn * 1.125);
    context.lineTo(40, 45);
    context.lineTo(24, 45);
    context.closePath();
    context.moveTo(25, 52);
    context.lineTo(39, 52);
    context.moveTo(28, 58);
    context.lineTo(36, 58);
  },
  spot(context) {
    context.moveTo(25, 8);
    context.lineTo(39, 8);
    context.lineTo(39, 20);
    context.lineTo(25, 20);
    context.closePath();
    context.moveTo(25, 20);
    context.lineTo(10, 54);
    context.lineTo(54, 54);
    context.lineTo(39, 20);
    context.moveTo(32, 26);
    context.lineTo(32, 46);
  },
  directional(context) {
    circle(context, 32, 32, 9);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * kTurn;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      context.moveTo(32 + (cos * 16), 32 + (sin * 16));
      context.lineTo(32 + (cos * 25), 32 + (sin * 25));
    }
  },
  hemisphere(context) {
    context.moveTo(12, 34);
    context.arc(32, 34, 20, kTurn / 2, kTurn);
    context.moveTo(6, 34);
    context.lineTo(58, 34);
    context.moveTo(16, 43);
    context.lineTo(48, 43);
    context.moveTo(24, 52);
    context.lineTo(40, 52);
  },
  ambient(context) {
    circle(context, 32, 32, 8);
    for (let dash = 0; dash < 8; dash++) {
      const start = ((dash + 0.25) / 8) * kTurn;
      const end = ((dash + 0.75) / 8) * kTurn;
      context.moveTo(
        32 + (Math.cos(start) * 22),
        32 + (Math.sin(start) * 22)
      );
      context.arc(32, 32, 22, start, end);
    }
  }
};

export class GizmoIcon extends CanvasSprite {
  #glyph: GizmoIconGlyph;

  constructor(
    glyph: GizmoIconGlyph
  ) {
    super({
      width: kCanvasSize,
      height: kCanvasSize,
      worldWidth: kSize,
      renderOrder: kRenderOrder
    });

    this.#glyph = glyph;
    this.material.sizeAttenuation = false;
    this.redraw();
  }

  get glyph(): GizmoIconGlyph {
    return this.#glyph;
  }

  set glyph(
    glyph: GizmoIconGlyph
  ) {
    if (glyph === this.#glyph) {
      return;
    }

    this.#glyph = glyph;
    this.redraw();
  }

  get color(): THREE.Color {
    return this.material.color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.material.color.set(color);
  }

  protected override paint(
    context: CanvasRenderingContext2D
  ): void {
    context.lineCap = "round";
    context.lineJoin = "round";

    context.beginPath();
    kGlyphs[this.#glyph](context);
    context.strokeStyle = kHaloColor;
    context.lineWidth = kHaloWidth;
    context.stroke();
    context.strokeStyle = kGlyphColor;
    context.lineWidth = kGlyphWidth;
    context.stroke();
  }
}

function circle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
): void {
  context.moveTo(x + radius, y);
  context.arc(x, y, radius, 0, kTurn);
}

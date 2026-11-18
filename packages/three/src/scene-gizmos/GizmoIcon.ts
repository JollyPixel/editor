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
const kIdleColor = "#ffffff";
const kTurn = Math.PI * 2;
const kSpeakerWaveAngle = kTurn / 8;
const kRectAreaRays = [
  [14, 8],
  [26, 23],
  [38, 41],
  [50, 56]
] as const;
export const GIZMO_SELECTED_COLOR = "#f5c46b";

export type GizmoIconGlyph =
  | "camera"
  | "point"
  | "spot"
  | "directional"
  | "hemisphere"
  | "ambient"
  | "rect-area"
  | "speaker"
  | "listener"
  | "audio-zone"
  | "rigid-body"
  | "joint"
  | "text"
  | "script"
  | "anchor"
  | "prefab"
  | "warning";

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
  },
  speaker(context) {
    context.moveTo(8, 25);
    context.lineTo(18, 25);
    context.lineTo(30, 13);
    context.lineTo(30, 51);
    context.lineTo(18, 39);
    context.lineTo(8, 39);
    context.closePath();
    for (const radius of [10, 20]) {
      context.moveTo(
        32 + (Math.cos(-kSpeakerWaveAngle) * radius),
        32 + (Math.sin(-kSpeakerWaveAngle) * radius)
      );
      context.arc(32, 32, radius, -kSpeakerWaveAngle, kSpeakerWaveAngle);
    }
  },
  "rect-area"(context) {
    context.moveTo(10, 12);
    context.lineTo(54, 12);
    context.lineTo(54, 24);
    context.lineTo(10, 24);
    context.closePath();
    for (const [startX, endX] of kRectAreaRays) {
      context.moveTo(startX, 34);
      context.lineTo(endX, 50);
    }
  },
  listener(context) {
    context.moveTo(13, 40);
    context.arc(32, 36, 19, kTurn / 2, kTurn);
    context.lineTo(51, 40);
    context.moveTo(8, 36);
    context.lineTo(18, 36);
    context.lineTo(18, 54);
    context.lineTo(8, 54);
    context.closePath();
    context.moveTo(46, 36);
    context.lineTo(56, 36);
    context.lineTo(56, 54);
    context.lineTo(46, 54);
    context.closePath();
  },
  "audio-zone"(context) {
    context.moveTo(17, 27);
    context.lineTo(23, 27);
    context.lineTo(32, 19);
    context.lineTo(32, 45);
    context.lineTo(23, 37);
    context.lineTo(17, 37);
    context.closePath();
    context.moveTo(
      32 + (Math.cos(-kSpeakerWaveAngle) * 11),
      32 + (Math.sin(-kSpeakerWaveAngle) * 11)
    );
    context.arc(32, 32, 11, -kSpeakerWaveAngle, kSpeakerWaveAngle);
    for (let dash = 0; dash < 10; dash++) {
      const start = ((dash + 0.25) / 10) * kTurn;
      const end = ((dash + 0.75) / 10) * kTurn;
      context.moveTo(
        32 + (Math.cos(start) * 26),
        32 + (Math.sin(start) * 26)
      );
      context.arc(32, 32, 26, start, end);
    }
  },
  "rigid-body"(context) {
    circle(context, 32, 17, 8);
    context.moveTo(18, 27);
    context.lineTo(46, 27);
    context.lineTo(54, 54);
    context.lineTo(10, 54);
    context.closePath();
  },
  joint(context) {
    const edge = 8 * Math.SQRT1_2;

    circle(context, 18, 46, 8);
    circle(context, 46, 18, 8);
    context.moveTo(18 + edge, 46 - edge);
    context.lineTo(46 - edge, 18 + edge);
  },
  text(context) {
    context.moveTo(14, 54);
    context.lineTo(32, 10);
    context.lineTo(50, 54);
    context.moveTo(21, 38);
    context.lineTo(43, 38);
  },
  script(context) {
    context.moveTo(26, 10);
    context.quadraticCurveTo(18, 10, 18, 18);
    context.lineTo(18, 26);
    context.quadraticCurveTo(18, 32, 11, 32);
    context.quadraticCurveTo(18, 32, 18, 38);
    context.lineTo(18, 46);
    context.quadraticCurveTo(18, 54, 26, 54);
    context.moveTo(38, 10);
    context.quadraticCurveTo(46, 10, 46, 18);
    context.lineTo(46, 26);
    context.quadraticCurveTo(46, 32, 53, 32);
    context.quadraticCurveTo(46, 32, 46, 38);
    context.lineTo(46, 46);
    context.quadraticCurveTo(46, 54, 38, 54);
  },
  anchor(context) {
    circle(context, 32, 12, 5);
    context.moveTo(32, 17);
    context.lineTo(32, 56);
    context.moveTo(22, 26);
    context.lineTo(42, 26);
    context.moveTo(10, 38);
    context.quadraticCurveTo(12, 56, 32, 56);
    context.quadraticCurveTo(52, 56, 54, 38);
  },
  prefab(context) {
    context.moveTo(32, 8);
    context.lineTo(54, 20);
    context.lineTo(54, 44);
    context.lineTo(32, 56);
    context.lineTo(10, 44);
    context.lineTo(10, 20);
    context.closePath();
    context.moveTo(10, 20);
    context.lineTo(32, 32);
    context.lineTo(54, 20);
    context.moveTo(32, 32);
    context.lineTo(32, 56);
  },
  warning(context) {
    context.moveTo(32, 8);
    context.lineTo(57, 53);
    context.lineTo(7, 53);
    context.closePath();
    context.moveTo(32, 23);
    context.lineTo(32, 37);
    circle(context, 32, 45, 0.5);
  }
};

export class GizmoIcon extends CanvasSprite {
  readonly #color = new THREE.Color(kIdleColor);
  readonly #selectedColor: THREE.Color;
  #glyph: GizmoIconGlyph;
  #selected = false;

  constructor(
    glyph: GizmoIconGlyph,
    selectedColor: THREE.ColorRepresentation
  ) {
    super({
      width: kCanvasSize,
      height: kCanvasSize,
      worldWidth: kSize,
      renderOrder: kRenderOrder
    });

    this.#glyph = glyph;
    this.#selectedColor = new THREE.Color(selectedColor);
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
    return this.#color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color.set(color);
    this.#tint();
  }

  get selected(): boolean {
    return this.#selected;
  }

  set selected(
    selected: boolean
  ) {
    this.#selected = selected;
    this.#tint();
  }

  #tint(): void {
    this.material.color.copy(
      this.#selected ? this.#selectedColor : this.#color
    );
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

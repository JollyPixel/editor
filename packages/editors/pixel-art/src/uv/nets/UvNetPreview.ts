// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  boundingRect,
  DEFAULT_UV_SLOTS,
  type SelectionRect,
  type UVNet,
  type UVRegion,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kSampleFace = {
  x: 0,
  y: 0,
  width: 8,
  height: 8
};
const kFacePixels = 56;
const kMaxPixelHeight = 200;

export type UvNetPreviewRegion = Pick<UVRegion, "activeSlots" | "slotGeometry">;

export interface UvNetPreviewCell {
  rect: SelectionRect;
  slots: readonly UVSlot[];
}

export class UvNetPreview {
  readonly cells: readonly UvNetPreviewCell[];
  readonly width: number;
  readonly height: number;
  readonly scale: number;

  constructor(
    net: UVNet,
    region: UvNetPreviewRegion | null
  ) {
    const faces = region === null ?
      DEFAULT_UV_SLOTS.map((face) => {
        return { face, geometry: kSampleFace };
      }) :
      region.activeSlots.map((face) => {
        return { face, geometry: region.slotGeometry(face) };
      });
    const cells = new Map<string, UvNetPreviewCell>();
    for (const [slot, geometry] of net.place(faces, { x: 0, y: 0 })) {
      const rect = boundingRect(geometry);
      const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
      cells.set(key, {
        rect,
        slots: [...cells.get(key)?.slots ?? [], slot]
      });
    }

    this.cells = Object.freeze([...cells.values()]);
    this.width = Math.max(1, ...this.cells.map(({ rect }) => rect.x + rect.width));
    this.height = Math.max(1, ...this.cells.map(({ rect }) => rect.y + rect.height));

    const largestSide = Math.max(
      1,
      ...this.cells.map(({ rect }) => Math.max(rect.width, rect.height))
    );
    this.scale = Math.min(kFacePixels / largestSide, kMaxPixelHeight / this.height);
  }

  render(): TemplateResult {
    return html`
      <div
        class="preview"
        part="uv-net-preview"
        role="img"
        aria-label="Net preview"
        style=${styleMap({
          width: `${this.width * this.scale}px`,
          aspectRatio: `${this.width} / ${this.height}`
        })}
      >
        ${this.cells.map(({ rect, slots }) => html`
          <div
            class=${classMap({ "preview-cell": true, shared: slots.length > 1 })}
            title=${slots.join(", ")}
            style=${styleMap({
              left: percent(rect.x, this.width),
              top: percent(rect.y, this.height),
              width: percent(rect.width, this.width),
              height: percent(rect.height, this.height)
            })}
          >${slots.map((slot) => html`<span>${slot}</span>`)}</div>
        `)}
      </div>
    `;
  }
}

function percent(
  value: number,
  total: number
): string {
  return `${value / total * 100}%`;
}

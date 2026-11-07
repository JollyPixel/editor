// Import Third-party Dependencies
import type {
  RGBA8,
  SelectionRect,
  UVSlot,
  UVLayoutData
} from "@jolly-pixel/pixel-draw.renderer";

export interface StrokeGhostSpan {
  color: RGBA8;
  xy: number[];
}

export interface StrokeGhostFrame {
  from: number;
  spans: StrokeGhostSpan[];
}

export interface UVGhostPayload {
  id: string;
  face: UVSlot | null;
  layout: UVLayoutData;
}

export type SelectionGhostPayload =
  | {
    phase: "creating" | "resizing";
    rect: SelectionRect;
  }
  | {
    phase: "selected";
    rect: SelectionRect;
    mask: Uint8Array | "full";
  }
  | {
    phase: "moving" | "floating";
    sourceRect: SelectionRect;
    liveRect: SelectionRect;
    pixels: Uint8Array;
    mask: Uint8Array | "full";
    eraseColor: RGBA8;
    blankSource: boolean;
  };

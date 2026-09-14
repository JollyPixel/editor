// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";
import {
  UVRegion,
  type RGBA8,
  type SelectionRect,
  type UVRegionData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelNetworkCommand } from "#src/network/types.ts";

export type PixelCommandAction = PixelNetworkCommand["action"];
export type PixelCommandOf<TAction extends PixelCommandAction> = Extract<
  PixelNetworkCommand,
  { action: TAction; }
>;

// CONSTANTS
const kDefaultHeader: NetworkCommandHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};
const kRegionRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 2,
  height: 2
};

export function command<TAction extends PixelCommandAction>(
  action: TAction,
  metadata: PixelCommandOf<TAction>["metadata"],
  header: Partial<NetworkCommandHeader> = {}
): PixelCommandOf<TAction> {
  return {
    ...kDefaultHeader,
    ...header,
    action,
    metadata
  } as PixelCommandOf<TAction>;
}

export function wholeCanvasCommands(): PixelNetworkCommand[] {
  return [
    command("resized", { size: { x: 1, y: 1 } }),
    command("texture-replaced", { size: { x: 1, y: 1 }, pixels: "" }),
    command("global-fill", { fromColor: gray(0), toColor: gray(1) })
  ];
}

export function gray(
  level: number
): RGBA8 {
  return {
    r: level,
    g: level,
    b: level,
    a: 255
  };
}

export function stackedRegion(
  id: string,
  rect: SelectionRect = kRegionRect
): UVRegionData {
  return {
    state: "stacked",
    id,
    rect,
    color: "#f00"
  };
}

export function freeRegion(
  id: string
): UVRegionData {
  return new UVRegion(stackedRegion(id)).free().toJSON();
}

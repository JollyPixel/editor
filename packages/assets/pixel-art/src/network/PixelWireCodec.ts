// Import Third-party Dependencies
import type {
  PixelCommand,
  RGBA8,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelNetworkCommand,
  PixelWireCommand,
  PixelWireEvent
} from "./types.ts";

export type PixelWireStrokeMetadata = Extract<
  PixelWireEvent,
  { action: "stroke"; }
>["metadata"];

export type PixelWireSelectEditMetadata = Extract<
  PixelWireEvent,
  { action: "select-edit"; }
>["metadata"];

export interface SelectEditPixels {
  positions: Vec2[];
  colors: RGBA8[];
}

export function packPositions(
  positions: readonly Vec2[]
): number[] {
  const xy = new Array<number>(positions.length * 2);
  for (let i = 0; i < positions.length; i++) {
    const { x, y } = positions[i];
    xy[i * 2] = x;
    xy[(i * 2) + 1] = y;
  }

  return xy;
}

export function unpackPositions(
  xy: readonly number[]
): Vec2[] {
  const positions = new Array<Vec2>(Math.floor(xy.length / 2));
  for (let i = 0; i < positions.length; i++) {
    positions[i] = {
      x: xy[i * 2],
      y: xy[(i * 2) + 1]
    };
  }

  return positions;
}

export function packColors(
  colors: readonly RGBA8[]
): number[] {
  const rgba = new Array<number>(colors.length * 4);
  for (let i = 0; i < colors.length; i++) {
    const { r, g, b, a } = colors[i];
    rgba[i * 4] = r;
    rgba[(i * 4) + 1] = g;
    rgba[(i * 4) + 2] = b;
    rgba[(i * 4) + 3] = a;
  }

  return rgba;
}

export function unpackColors(
  rgba: readonly number[]
): RGBA8[] {
  const colors = new Array<RGBA8>(Math.floor(rgba.length / 4));
  for (let i = 0; i < colors.length; i++) {
    colors[i] = {
      r: rgba[i * 4],
      g: rgba[(i * 4) + 1],
      b: rgba[(i * 4) + 2],
      a: rgba[(i * 4) + 3]
    };
  }

  return colors;
}

export function strokePositions(
  metadata: PixelWireStrokeMetadata
): Vec2[] {
  return "xy" in metadata ?
    unpackPositions(metadata.xy) :
    metadata.positions;
}

export function selectEditPixels(
  metadata: PixelWireSelectEditMetadata
): SelectEditPixels {
  if ("xy" in metadata) {
    return {
      positions: unpackPositions(metadata.xy),
      colors: unpackColors(metadata.rgba)
    };
  }

  return {
    positions: metadata.positions,
    colors: metadata.colors
  };
}

export function packPixelEvent(
  event: PixelCommand
): PixelWireEvent {
  switch (event.action) {
    case "stroke":
      return {
        ...event,
        metadata: {
          color: event.metadata.color,
          xy: packPositions(event.metadata.positions)
        }
      };
    case "select-edit":
      return {
        ...event,
        metadata: {
          xy: packPositions(event.metadata.positions),
          rgba: packColors(event.metadata.colors)
        }
      };
    default:
      return event;
  }
}

export function unpackPixelCommand(
  command: PixelWireCommand
): PixelNetworkCommand {
  switch (command.action) {
    case "stroke":
      return {
        ...command,
        metadata: {
          color: command.metadata.color,
          positions: strokePositions(command.metadata)
        }
      };
    case "select-edit":
      return {
        ...command,
        metadata: selectEditPixels(command.metadata)
      };
    default:
      return command;
  }
}

// Import Internal Dependencies
import { groupPositionsByColor } from "../buffer/colorGroups.ts";
import {
  decodePixelBytes,
  encodePixelBytes
} from "../serialization/pixelBytes.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  UVGeometry,
  UVSlot,
  UVRegionData
} from "../uv/region/UVRegion.ts";
import type {
  IndexedNormalMapZone,
  NormalMapData,
  NormalMapSettings
} from "../normal/types.ts";

export type UVRegionRotation =
  | {
    id: string;
    face: UVSlot;
    geometry: UVGeometry;
  }
  | {
    id: string;
    face: null;
    region: UVRegionData;
  };

export type NormalMapCommand =
  | {
    action: "normal-map-toggled";
    metadata: {
      config: NormalMapData | null;
    };
  }
  | {
    action: "normal-map-defaults-patched";
    metadata: {
      patch: Partial<NormalMapSettings>;
    };
  }
  | {
    action: "normal-map-zone-set";
    metadata: IndexedNormalMapZone;
  }
  | {
    action: "normal-map-zone-deleted";
    metadata: {
      regionId: string;
    };
  };

type CommandOf<TPixels> =
  | {
    action: "stroke";
    metadata: {
      color: RGBA8;
      positions: Vec2[];
    };
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      pixels: TPixels;
    };
  }
  | {
    action: "global-fill";
    metadata: {
      fromColor: RGBA8;
      toColor: RGBA8;
    };
  }
  | {
    action: "select-edit";
    metadata: {
      positions: Vec2[];
      colors: RGBA8[];
    };
  }
  | {
    action: "uv-region-created";
    metadata: {
      region: UVRegionData;
    };
  }
  | {
    action: "uv-region-deleted";
    metadata: {
      id: string;
    };
  }
  | {
    action: "uv-region-moved";
    metadata: {
      id: string;
      face: UVSlot | null;
      rect: SelectionRect;
    };
  }
  | {
    action: "uv-region-state-changed";
    metadata: {
      region: UVRegionData;
    };
  }
  | {
    action: "uv-region-rotated";
    metadata: UVRegionRotation;
  }
  | NormalMapCommand;

export type DocumentCommand = CommandOf<Uint8ClampedArray>;

export type PixelCommand = CommandOf<string> & {
  originTimestamp?: number;
};

export type PixelCommandAction = DocumentCommand["action"];

export function toPixelCommand(
  command: DocumentCommand,
  originTimestamp?: number
): PixelCommand {
  const encoded: PixelCommand = command.action === "texture-replaced" ?
    {
      action: "texture-replaced",
      metadata: {
        size: command.metadata.size,
        pixels: encodePixelBytes(command.metadata.pixels)
      }
    } :
    command;

  return originTimestamp === undefined ?
    encoded :
    { ...encoded, originTimestamp };
}

export function toDocumentCommand(
  command: PixelCommand
): DocumentCommand {
  if (command.action !== "texture-replaced") {
    return command;
  }

  return {
    action: "texture-replaced",
    metadata: {
      size: command.metadata.size,
      pixels: decodePixelBytes(command.metadata.pixels)
    }
  };
}

export function strokeOf(
  positions: Vec2[],
  color: RGBA8
): DocumentCommand {
  return {
    action: "stroke",
    metadata: { color, positions }
  };
}

export function strokesOf(
  positions: Vec2[],
  colors: RGBA8[]
): DocumentCommand[] {
  return groupPositionsByColor(positions, colors).map(
    (group) => strokeOf(group.positions, group.color)
  );
}

export function selectEditOf(
  positions: Vec2[],
  colors: RGBA8[]
): DocumentCommand {
  return {
    action: "select-edit",
    metadata: { positions, colors }
  };
}

export function textureOf(
  size: Vec2,
  pixels: Uint8ClampedArray
): DocumentCommand {
  return {
    action: "texture-replaced",
    metadata: { size, pixels }
  };
}

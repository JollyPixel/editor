// Import Third-party Dependencies
import { equalRGBA8 } from "@jolly-pixel/color";

// Import Internal Dependencies
import { groupPositionsByColor } from "../buffer/colorGroups.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  UVGeometry,
  UVRegion,
  UVSlot,
  UVRegionData
} from "../uv/region/UVRegion.ts";
import type {
  IndexedNormalMapZone,
  NormalMapData,
  NormalMapSettings
} from "../normal/types.ts";
import type { SavedUVNetData } from "../uv/region/SavedUVNet.ts";
import type { UVOrientationOperation } from "../uv/map/UVMap.events.ts";

// CONSTANTS
const kOrientationActions = {
  rotate: "uv-region-rotated",
  mirror: "uv-region-mirrored"
} as const satisfies Record<UVOrientationOperation, PixelCommandAction>;

type UVOrientationAction =
  (typeof kOrientationActions)[UVOrientationOperation];

export type UVOrientationCommand = Extract<
  PixelDocumentCommand,
  { action: UVOrientationAction; }
>;

export type UVRegionOrientation =
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
    action: "palette-color-changed";
    metadata: {
      index: number;
      color: RGBA8;
    };
  }
  | {
    action: "palette-replaced";
    metadata: {
      colors: RGBA8[];
    };
  }
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
    metadata: UVRegionOrientation;
  }
  | {
    action: "uv-region-mirrored";
    metadata: UVRegionOrientation;
  }
  | UVNetCommand
  | NormalMapCommand;

export type UVNetCommand =
  | {
    action: "uv-net-saved";
    metadata: {
      net: SavedUVNetData;
    };
  }
  | {
    action: "uv-net-deleted";
    metadata: {
      id: string;
    };
  }
  | {
    action: "uv-net-default-changed";
    metadata: {
      id: string | null;
    };
  };

export type PixelDocumentCommand = CommandOf<Uint8ClampedArray>;

export type PixelCommand = CommandOf<Uint8Array>;

export type PixelCommandAction = PixelDocumentCommand["action"];

export function toPixelCommand(
  command: PixelDocumentCommand
): PixelCommand {
  return command.action === "texture-replaced" ?
    {
      action: "texture-replaced",
      metadata: {
        size: command.metadata.size,
        pixels: new Uint8Array(command.metadata.pixels)
      }
    } :
    command;
}

export function toPixelDocumentCommand(
  command: PixelCommand
): PixelDocumentCommand {
  if (command.action !== "texture-replaced") {
    return command;
  }

  return {
    action: "texture-replaced",
    metadata: {
      size: command.metadata.size,
      pixels: new Uint8ClampedArray(command.metadata.pixels)
    }
  };
}

export function strokeCommand(
  positions: Vec2[],
  color: RGBA8
): PixelDocumentCommand {
  return {
    action: "stroke",
    metadata: { color, positions }
  };
}

export function paintCommand(
  positions: Vec2[],
  colors: RGBA8[]
): PixelDocumentCommand {
  const [first] = colors;

  return colors.every((color) => equalRGBA8(color, first)) ?
    strokeCommand(positions, first) :
    selectEditCommand(positions, colors);
}

export function strokeCommands(
  positions: Vec2[],
  colors: RGBA8[]
): PixelDocumentCommand[] {
  return groupPositionsByColor(positions, colors).map(
    (group) => strokeCommand(group.positions, group.color)
  );
}

export function paletteReplaced(
  colors: RGBA8[]
): PixelDocumentCommand {
  return {
    action: "palette-replaced",
    metadata: { colors }
  };
}

export function selectEditCommand(
  positions: Vec2[],
  colors: RGBA8[]
): PixelDocumentCommand {
  return {
    action: "select-edit",
    metadata: { positions, colors }
  };
}

export function textureCommand(
  size: Vec2,
  pixels: Uint8ClampedArray
): PixelDocumentCommand {
  return {
    action: "texture-replaced",
    metadata: { size, pixels }
  };
}

export function uvRegionCreated(
  region: UVRegionData
): PixelDocumentCommand {
  return {
    action: "uv-region-created",
    metadata: { region }
  };
}

export function uvRegionDeleted(
  id: string
): PixelDocumentCommand {
  return {
    action: "uv-region-deleted",
    metadata: { id }
  };
}

export function uvRegionMoved(
  id: string,
  face: UVSlot | null,
  rect: SelectionRect
): PixelDocumentCommand {
  return {
    action: "uv-region-moved",
    metadata: {
      id,
      face,
      rect
    }
  };
}

export function uvRegionStateChanged(
  region: UVRegionData
): PixelDocumentCommand {
  return {
    action: "uv-region-state-changed",
    metadata: { region }
  };
}

function uvRegionOrientation(
  region: UVRegion,
  face: UVSlot | null
): UVRegionOrientation {
  return face === null ?
    {
      id: region.id,
      face,
      region: region.toJSON()
    } :
    {
      id: region.id,
      face,
      geometry: region.slotGeometry(face)
    };
}

export function uvRegionReoriented(
  operation: UVOrientationOperation,
  region: UVRegion,
  face: UVSlot | null
): PixelDocumentCommand {
  return {
    action: kOrientationActions[operation],
    metadata: uvRegionOrientation(region, face)
  };
}

export function orientationOperation(
  action: UVOrientationAction
): UVOrientationOperation {
  return action === kOrientationActions.rotate ? "rotate" : "mirror";
}

export function uvNetSaved(
  net: SavedUVNetData
): UVNetCommand {
  return {
    action: "uv-net-saved",
    metadata: { net }
  };
}

export function uvNetDeleted(
  id: string
): UVNetCommand {
  return {
    action: "uv-net-deleted",
    metadata: { id }
  };
}

export function uvNetDefaultChanged(
  id: string | null
): UVNetCommand {
  return {
    action: "uv-net-default-changed",
    metadata: { id }
  };
}

export function uvNetId(
  command: UVNetCommand
): string | null {
  switch (command.action) {
    case "uv-net-saved":
      return command.metadata.net.id;
    case "uv-net-deleted":
      return command.metadata.id;
    case "uv-net-default-changed":
      return null;
  }
}

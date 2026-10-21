// Import Internal Dependencies
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type { SelectionChange } from "../selection/SelectionFootprint.ts";
import type { PixelDocumentCommand } from "./PixelCommand.ts";
import type { EditChange } from "./EditChange.ts";

export type PixelChange = EditChange<PixelDocumentCommand>;

export interface LocalEdit {
  command: PixelDocumentCommand;
  inverse: PixelDocumentCommand[];
  sent?: PixelDocumentCommand;
}

export interface GlobalFill {
  positions: Vec2[];
  fromColor: RGBA8;
  toColor: RGBA8;
}

export interface SelectionEdit extends SelectionChange {
  positions: Vec2[];
  beforeColors: RGBA8[];
  afterColors: RGBA8[];
}

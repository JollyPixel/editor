// Import Internal Dependencies
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type { SelectionChange } from "../history/HistoryEntry.ts";

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

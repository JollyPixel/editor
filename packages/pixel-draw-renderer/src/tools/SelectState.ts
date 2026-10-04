// Import Internal Dependencies
import type { SelectionContent } from "../selection/SelectionContent.ts";
import type { ResizeCorner } from "../utils/RectArea.ts";
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";

export type SelectState =
  | {
    kind: "idle";
  }
  | {
    kind: "creating";
    start: Vec2;
    rect: SelectionRect;
  }
  | {
    kind: "selected";
    content: SelectionContent;
    floating: boolean;
  }
  | {
    kind: "resizing";
    content: SelectionContent;
    corner: ResizeCorner;
    origin: Vec2;
    rect: SelectionRect;
  }
  | {
    kind: "moving";
    content: SelectionContent;
    floating: boolean;
    origin: Vec2;
    live: SelectionContent;
    eraseColor: RGBA8;
  };


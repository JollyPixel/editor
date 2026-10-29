// Import Internal Dependencies
import type { BrushToolHandler } from "../sculpt/model/BrushToolHandler.ts";
import {
  HoleStroke,
  type HoleStrokeOptions
} from "./model/HoleStroke.ts";

export function holeTool(
  options: HoleStrokeOptions
): BrushToolHandler {
  return {
    hitsHoles: true,
    begin: ({ point, lower }) => (lower ? null : new HoleStroke(options, point))
  };
}

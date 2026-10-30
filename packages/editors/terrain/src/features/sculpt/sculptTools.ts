// Import Internal Dependencies
import type { BrushToolHandler } from "../brush/model/BrushToolHandler.ts";
import {
  RampStroke,
  type RampStrokeOptions
} from "./model/RampStroke.ts";
import type { SculptTool } from "./model/sculptStamp.ts";
import {
  SculptStroke,
  type SculptStrokeOptions
} from "./model/SculptStroke.ts";
import type { SculptSettings } from "../../state/SculptSettings.ts";

export interface SculptToolsOptions extends SculptStrokeOptions {
  settings: Pick<SculptSettings, "options" | "update">;
}

export function rampTool(
  options: RampStrokeOptions
): BrushToolHandler {
  return {
    begin: (press) => (press.lower ? null : new RampStroke(options, press))
  };
}

export function sculptTools(
  options: SculptToolsOptions
): Readonly<Record<SculptTool, BrushToolHandler>> {
  function stroke(
    tool: SculptTool
  ): BrushToolHandler["begin"] {
    return (press) => new SculptStroke(options, { ...press, tool });
  }

  return {
    raise: { begin: stroke("raise"), pick: () => undefined },
    smooth: { begin: stroke("smooth"), pick: () => undefined },
    terrace: { begin: stroke("terrace"), pick: () => undefined },
    flatten: {
      begin: stroke("flatten"),
      pick: ({ point }) => options.settings.update({
        flattenTarget: "fixed",
        flattenHeight: Math.round(point.y * 100) / 100
      })
    }
  };
}

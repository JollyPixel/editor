// Import Internal Dependencies
import {
  StrokeMode,
  type StrokeModeOptions
} from "./StrokeMode.ts";
import type { Mode } from "../../types.ts";

export type EraseModeOptions = StrokeModeOptions;

export class EraseMode extends StrokeMode {
  readonly id: Mode = "erase";

  constructor(
    options: EraseModeOptions
  ) {
    super(options, "erase");
  }
}

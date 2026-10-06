// Import Internal Dependencies
import type {
  ConsoleValue,
  ConsoleValueType
} from "../registry/types.ts";
import type { ScriptLine } from "./scanScript.ts";

export interface ScriptDiagnostic {
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

export interface ScriptChange {
  readonly line: number;
  readonly address: string;
  readonly value: ConsoleValue;
}

export interface ScriptDraftOptions {
  lines: readonly ScriptLine[];
  changes: readonly ScriptChange[];
  diagnostics: readonly ScriptDiagnostic[];
  valueTypes: ReadonlyMap<number, ConsoleValueType>;
}

export class ScriptDraft {
  readonly lines: readonly ScriptLine[];
  readonly changes: readonly ScriptChange[];
  readonly diagnostics: readonly ScriptDiagnostic[];

  #valueTypes: ReadonlyMap<number, ConsoleValueType>;

  constructor(
    options: ScriptDraftOptions
  ) {
    this.lines = options.lines;
    this.changes = options.changes;
    this.diagnostics = options.diagnostics;
    this.#valueTypes = options.valueTypes;
  }

  get ok(): boolean {
    return this.diagnostics.length === 0;
  }

  valueType(
    line: number
  ): ConsoleValueType | undefined {
    return this.#valueTypes.get(line);
  }
}

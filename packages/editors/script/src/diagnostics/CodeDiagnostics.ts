// Import Third-party Dependencies
import type { ScriptChange } from "@jolly-pixel/asset.script/client";
import type {
  ScriptDiagnostic,
  ScriptDiagnosticSeverity
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import type { TextLines } from "../text/TextLines.ts";

export type DiagnosticSource = "lint" | "types";

export class CodeDiagnostics {
  #onChange: () => void;
  #sources = new Map<DiagnosticSource, readonly ScriptDiagnostic[]>();
  #all: readonly ScriptDiagnostic[] = [];

  constructor(
    onChange: () => void
  ) {
    this.#onChange = onChange;
  }

  get all(): readonly ScriptDiagnostic[] {
    return this.#all;
  }

  replace(
    source: DiagnosticSource,
    diagnostics: Iterable<ScriptDiagnostic>
  ): void {
    this.#sources.set(source, Array.from(diagnostics));
    this.#merge();
  }

  follow(
    { edit, origin }: ScriptChange
  ): void {
    if (origin === "load") {
      this.#sources.clear();
    }
    for (const [source, diagnostics] of this.#sources) {
      this.#sources.set(source, diagnostics.map((diagnostic) => {
        const start = edit.mapPosition(diagnostic.start, "after");
        const end = edit.mapPosition(diagnostic.start + diagnostic.length, "before");

        return {
          ...diagnostic,
          start,
          length: Math.max(end - start, 0)
        };
      }));
    }
    this.#merge();
  }

  at(
    offset: number
  ): ScriptDiagnostic[] {
    return this.#all.filter((diagnostic) => (
      diagnostic.start <= offset &&
      offset <= diagnostic.start + Math.max(diagnostic.length, 1)
    ));
  }

  within(
    from: number,
    to: number
  ): ScriptDiagnostic[] {
    return this.#all.filter((diagnostic) => (
      diagnostic.start <= to &&
      diagnostic.start + diagnostic.length >= from
    ));
  }

  lineSeverity(
    lines: TextLines,
    line: number
  ): ScriptDiagnosticSeverity | null {
    const from = lines.lineStart(line);
    let severity: ScriptDiagnosticSeverity | null = null;
    for (const diagnostic of this.within(from, from + lines.line(line).length)) {
      if (diagnostic.severity === "error") {
        return "error";
      }
      severity = diagnostic.severity;
    }

    return severity;
  }

  #merge(): void {
    this.#all = Array.from(this.#sources.values())
      .flat()
      .sort((left, right) => left.start - right.start);
    this.#onChange();
  }
}

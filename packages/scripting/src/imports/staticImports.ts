// Import Third-party Dependencies
import {
  init as initLexer,
  parse
} from "es-module-lexer";

// Import Internal Dependencies
import { ScriptImportError } from "./errors/ScriptImportError.ts";

export interface StaticImport {
  readonly specifier: string;
  readonly start: number;
  readonly end: number;
}

export async function staticImports(
  code: string
): Promise<StaticImport[]> {
  await initLexer();
  const [imports] = parse(code);
  const found: StaticImport[] = [];

  for (const entry of imports) {
    if (entry.type === "import-meta") {
      continue;
    }
    if (entry.type === "dynamic") {
      throw new ScriptImportError("Modules cannot be imported dynamically.");
    }

    found.push({
      specifier: entry.specifier,
      start: entry.start,
      end: entry.end
    });
  }

  return found;
}

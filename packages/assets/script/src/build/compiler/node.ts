// Import Internal Dependencies
import { ScriptBuildError } from "../errors/ScriptBuildError.ts";

type TypeScript = typeof import("ts-morph").ts;

// CONSTANTS
const kSourceFileName = "script.ts";

let typescript: Promise<TypeScript> | null = null;

export async function compileScript(
  source: string
): Promise<string> {
  typescript ??= import("ts-morph").then((morph) => morph.ts);
  const ts = await typescript;

  const output = ts.transpileModule(source, {
    fileName: kSourceFileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      inlineSourceMap: true,
      inlineSources: true
    }
  });
  const error = output.diagnostics?.find(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  if (error !== undefined) {
    throw new ScriptBuildError(diagnosticMessage(ts, error));
  }

  return output.outputText;
}

function diagnosticMessage(
  ts: TypeScript,
  diagnostic: import("ts-morph").ts.Diagnostic
): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.file === undefined || diagnostic.start === undefined) {
    return message;
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );

  return `${message} (${line + 1}:${character + 1})`;
}

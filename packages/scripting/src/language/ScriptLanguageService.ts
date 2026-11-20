// Import Third-party Dependencies
import ts from "typescript";

// Import Internal Dependencies
import type { ScriptDiagnostic } from "../diagnostics/ScriptDiagnostic.schema.ts";
import { isRelativeSpecifier } from "../imports/ScriptImportPolicy.ts";
import {
  LIB_DIRECTORY,
  SCRIPT_COMPILER_OPTIONS
} from "./compilerOptions.ts";

export type ScriptTypeFiles = Readonly<Record<string, string>>;

export interface ScriptCompletion {
  name: string;
  kind: string;
  insertText: string;
  start: number;
  length: number;
}

export interface ScriptQuickInfo {
  start: number;
  length: number;
  signature: string;
  documentation: string;
}

// CONSTANTS
const kProjectDirectory = "/project";
const kMissingModuleCodes = new Set([2307, 2792]);
const kWordBefore = /[\p{ID_Continue}$]*$/u;
const kMaxCompletions = 100;

export class ScriptLanguageService {
  #fileName: string;
  #files: ScriptTypeFiles;
  #directories = new Map<string, Set<string>>();
  #text = "";
  #version = 0;
  #service: ts.LanguageService;

  constructor(
    files: ScriptTypeFiles,
    path: string
  ) {
    this.#files = files;
    this.#fileName = `${kProjectDirectory}/${path.replace(/^\/+/, "")}`;
    for (const file of [...Object.keys(files), this.#fileName]) {
      this.#index(file);
    }
    this.#service = ts.createLanguageService(
      this.#host(),
      ts.createDocumentRegistry(true, "/")
    );
  }

  diagnostics(
    text: string
  ): ScriptDiagnostic[] {
    this.#update(text);
    const found = [
      ...this.#service.getSyntacticDiagnostics(this.#fileName),
      ...this.#service.getSemanticDiagnostics(this.#fileName)
    ];

    return found
      .filter((diagnostic) => !isMissingScript(diagnostic, text))
      .map(toScriptDiagnostic);
  }

  completions(
    text: string,
    offset: number
  ): ScriptCompletion[] {
    this.#update(text);
    const info = this.#service.getCompletionsAtPosition(this.#fileName, offset, {
      includeCompletionsWithInsertText: true
    });
    if (info === undefined) {
      return [];
    }

    const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
    const word = kWordBefore.exec(text.slice(lineStart, offset))?.[0] ?? "";
    const prefix = word.toLowerCase();

    return info.entries
      .filter((entry) => entry.name.toLowerCase().startsWith(prefix))
      .sort((left, right) => (
        left.sortText.localeCompare(right.sortText) ||
        left.name.localeCompare(right.name)
      ))
      .slice(0, kMaxCompletions)
      .map((entry) => {
        const span = entry.replacementSpan ?? {
          start: offset - word.length,
          length: word.length
        };

        return {
          name: entry.name,
          kind: entry.kind,
          insertText: entry.insertText ?? entry.name,
          start: span.start,
          length: span.length
        };
      });
  }

  quickInfo(
    text: string,
    offset: number
  ): ScriptQuickInfo | null {
    this.#update(text);
    const info = this.#service.getQuickInfoAtPosition(this.#fileName, offset);
    if (info === undefined) {
      return null;
    }

    return {
      start: info.textSpan.start,
      length: info.textSpan.length,
      signature: ts.displayPartsToString(info.displayParts),
      documentation: ts.displayPartsToString(info.documentation)
    };
  }

  dispose(): void {
    this.#service.dispose();
  }

  #update(
    text: string
  ): void {
    if (text !== this.#text) {
      this.#text = text;
      this.#version++;
    }
  }

  #read(
    file: string
  ): string | undefined {
    return file === this.#fileName ? this.#text : this.#files[file];
  }

  #index(
    file: string
  ): void {
    let child = file;
    for (let dir = parent(file); dir !== null; dir = parent(dir)) {
      const children = this.#directories.get(dir);
      if (children === undefined) {
        this.#directories.set(dir, new Set([child]));
      }
      else {
        children.add(child);
      }
      child = dir;
    }
  }

  #host(): ts.LanguageServiceHost {
    return {
      getCompilationSettings: () => SCRIPT_COMPILER_OPTIONS,
      getScriptFileNames: () => [this.#fileName],
      getScriptVersion: (file) => (
        file === this.#fileName ? String(this.#version) : "0"
      ),
      getScriptSnapshot: (file) => {
        const text = this.#read(file);

        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => kProjectDirectory,
      getDefaultLibFileName: (options) => (
        `${LIB_DIRECTORY}/${ts.getDefaultLibFileName(options)}`
      ),
      fileExists: (file) => this.#read(file) !== undefined,
      readFile: (file) => this.#read(file),
      directoryExists: (dir) => this.#directories.has(trimSlash(dir)),
      getDirectories: (dir) => Array.from(
        this.#directories.get(trimSlash(dir)) ?? [],
        (child) => child.slice(child.lastIndexOf("/") + 1)
      ).filter((name) => this.#directories.has(`${trimSlash(dir)}/${name}`)),
      realpath: (file) => file,
      useCaseSensitiveFileNames: () => true
    };
  }
}

function parent(
  file: string
): string | null {
  if (file === "/") {
    return null;
  }
  const at = file.lastIndexOf("/");

  return at <= 0 ? "/" : file.slice(0, at);
}

function trimSlash(
  dir: string
): string {
  return dir.length > 1 && dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

function isMissingScript(
  diagnostic: ts.Diagnostic,
  text: string
): boolean {
  if (!kMissingModuleCodes.has(diagnostic.code) || diagnostic.start === undefined) {
    return false;
  }
  const literal = text.slice(diagnostic.start, diagnostic.start + (diagnostic.length ?? 0));

  return isRelativeSpecifier(literal.slice(1, -1));
}

function toScriptDiagnostic(
  diagnostic: ts.Diagnostic
): ScriptDiagnostic {
  return {
    start: diagnostic.start ?? 0,
    length: diagnostic.length ?? 0,
    severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    code: `ts(${diagnostic.code})`
  };
}

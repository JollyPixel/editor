// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { DevEnvironment } from "vite";

// CONSTANTS
const kModuleScript = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/g;
const kVirtualPrefix = "\0";
const kScannedExtensions = new Set([
  ".ts",
  ".mts",
  ".js",
  ".mjs"
]);

export interface ModuleSource {
  resolve(
    specifier: string,
    importer: string
  ): Promise<string | null>;
  load(
    id: string
  ): Promise<string | null>;
}

export interface WorkspaceImportScanOptions {
  modules: ModuleSource;
  scope: string;
}

export class WorkspaceImportScan {
  readonly #modules: ModuleSource;
  readonly #scope: string;
  readonly #visited = new Set<string>();
  readonly #entries = new Set<string>();

  constructor(
    options: WorkspaceImportScanOptions
  ) {
    this.#modules = options.modules;
    this.#scope = options.scope;
  }

  get entries(): string[] {
    return [...this.#entries].sort();
  }

  async scanPage(
    file: string
  ): Promise<void> {
    const html = await this.#read(file);
    if (html === null) {
      return;
    }
    for (const [, source] of html.matchAll(kModuleScript)) {
      await this.#follow(source, file);
    }
  }

  async #follow(
    specifier: string,
    importer: string
  ): Promise<void> {
    if (specifier.startsWith(this.#scope)) {
      this.#entries.add(specifier);

      return;
    }

    const id = await this.#modules.resolve(
      specifier,
      importer
    );
    if (id === null || !isScanned(id)) {
      return;
    }

    const code = await this.#read(id);
    if (code === null) {
      return;
    }
    for (const imported of await importsOf(code)) {
      await this.#follow(imported, id);
    }
  }

  async #read(
    id: string
  ): Promise<string | null> {
    if (this.#visited.has(id)) {
      return null;
    }
    this.#visited.add(id);

    return this.#modules.load(id);
  }
}

export function containerModuleSource(
  container: DevEnvironment["pluginContainer"]
): ModuleSource {
  return {
    async resolve(specifier, importer) {
      const resolved = await container.resolveId(
        specifier,
        importer
      );

      return resolved?.id ?? null;
    },
    async load(id) {
      const loaded = await container.load(id);
      if (loaded !== null && loaded !== undefined) {
        return typeof loaded === "string" ? loaded : loaded.code;
      }

      return isVirtual(id) ? null : fs.readFile(fileOf(id), "utf8");
    }
  };
}

function isScanned(
  id: string
): boolean {
  if (isVirtual(id)) {
    return true;
  }

  const file = fileOf(id);

  return !file.includes("/node_modules/") &&
    kScannedExtensions.has(path.extname(file));
}

function isVirtual(
  id: string
): boolean {
  return id.startsWith(kVirtualPrefix);
}

function fileOf(
  id: string
): string {
  return id.split("?")[0];
}

async function importsOf(
  code: string
): Promise<string[]> {
  const { parseAstAsync } = await import("vite");
  const program = await parseAstAsync(
    code,
    { lang: "ts" }
  );
  const specifiers: string[] = [];
  collectImports(program, specifiers);

  return specifiers;
}

function collectImports(
  node: unknown,
  specifiers: string[]
): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectImports(child, specifiers);
    }

    return;
  }

  if (
    typeof node !== "object" ||
    node === null
  ) {
    return;
  }

  const specifier = importedBy(node);
  if (specifier !== null) {
    specifiers.push(specifier);
  }
  for (const child of Object.values(node)) {
    collectImports(child, specifiers);
  }
}

function importedBy(
  node: object
): string | null {
  if (!("type" in node) || !("source" in node)) {
    return null;
  }

  switch (node.type) {
    case "ImportDeclaration":
      return "importKind" in node && node.importKind === "type" ?
        null :
        literalOf(node.source);
    case "ExportAllDeclaration":
    case "ExportNamedDeclaration":
      return "exportKind" in node && node.exportKind === "type" ?
        null :
        literalOf(node.source);
    case "ImportExpression":
      return literalOf(node.source);
    default:
      return null;
  }
}

function literalOf(
  source: unknown
): string | null {
  return typeof source === "object" &&
    source !== null &&
    "value" in source &&
    typeof source.value === "string" ?
    source.value :
    null;
}

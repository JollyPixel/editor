// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ScriptImportError } from "./errors/ScriptImportError.ts";
import { isRelativeSpecifier } from "./ScriptImportPolicy.ts";
import { staticImports } from "./staticImports.ts";

// CONSTANTS
export const SCRIPT_KIND = "script";

const kScriptExtension = ".ts";
const kAliasExtensions = [".js", ""];

export class ScriptModules {
  #bySpecifier = new Map<string, AssetRecord>();

  constructor(
    records: Iterable<AssetRecord>
  ) {
    const scripts = Array.from(records)
      .filter((record) => record.hasKind(SCRIPT_KIND));

    for (const extension of kAliasExtensions) {
      for (const script of scripts) {
        const path = script.path.value;
        if (path.endsWith(kScriptExtension)) {
          const stem = path.slice(0, -kScriptExtension.length);
          this.#bySpecifier.set(`${stem}${extension}`, script);
        }
      }
    }
    for (const script of scripts) {
      this.#bySpecifier.set(script.path.value, script);
    }
  }

  resolve(
    path: string
  ): AssetRecord | undefined {
    return this.#bySpecifier.get(path);
  }

  entries(): IterableIterator<[string, AssetRecord]> {
    return this.#bySpecifier.entries();
  }

  async imported(
    importer: AssetRecord,
    code: string
  ): Promise<AssetRecord[]> {
    const imports = await staticImports(code);

    return imports
      .filter(({ specifier }) => isRelativeSpecifier(specifier))
      .map(({ specifier }) => this.#imported(importer, specifier));
  }

  #imported(
    importer: AssetRecord,
    specifier: string
  ): AssetRecord {
    const script = this.resolve(importer.path.resolve(specifier).value);
    if (script === undefined) {
      throw new ScriptImportError(
        `"${importer.path}" imports "${specifier}", which is no script of the game.`
      );
    }

    return script;
  }
}

// Import Third-party Dependencies
import type {
  AssetCatalog,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ScriptImportError } from "./errors/ScriptImportError.ts";
import { isRelativeSpecifier } from "./ScriptImportPolicy.ts";
import { staticImports } from "./staticImports.ts";

// CONSTANTS
export const SCRIPT_KIND = "script";

export async function importedScripts(
  importer: AssetRecord,
  code: string,
  catalog: AssetCatalog
): Promise<AssetRecord[]> {
  const imports = await staticImports(code);

  return imports
    .filter(({ specifier }) => isRelativeSpecifier(specifier))
    .map(({ specifier }) => scriptAt(catalog, importer, specifier));
}

export function scriptAt(
  catalog: AssetCatalog,
  importer: AssetRecord,
  specifier: string
): AssetRecord {
  const target = importer.path.resolve(specifier).toString();
  const candidates = [
    target,
    `${target}.ts`,
    target.replace(/\.js$/, ".ts")
  ];

  for (const candidate of candidates) {
    const record = catalog.findByPath(candidate);
    if (record?.hasKind(SCRIPT_KIND)) {
      return record;
    }
  }

  throw new ScriptImportError(
    `"${importer.path}" imports "${specifier}", which is no script of the game.`
  );
}

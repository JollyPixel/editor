// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import { KINDS_EXPORT } from "../project/KindPackage.ts";
import type { ProjectKinds } from "../project/ProjectKinds.ts";

// CONSTANTS
export const PROJECT_HANDLERS_MODULE_ID = "virtual:jolly-pixel/handlers";
const kResolvedModuleId = `\0${PROJECT_HANDLERS_MODULE_ID}`;

export function projectHandlersModule(
  kinds: ProjectKinds
): string {
  const imports = kinds.packages.map((kindPackage, index) => (
    `import { ${KINDS_EXPORT} as kinds${index} } from ${JSON.stringify(kindPackage.name)};\n`
  ));
  const handlers = kinds.packages.map((kindPackage, index) => (
    `    ...kinds${index}.handlers(${JSON.stringify(kindPackage.options)}),\n`
  ));

  return "import { textureAssetKind } from \"@jolly-pixel/asset-server\";\n" +
    `${imports.join("")}\n` +
    "export default function createHandlers() {\n" +
    `  return [\n${handlers.join("")}    textureAssetKind()\n  ];\n` +
    "}\n";
}

export function createProjectKindsPlugin(
  kinds: ProjectKinds
): Plugin {
  const packageNames = new Set(
    kinds.packages.map((kindPackage) => kindPackage.name)
  );

  return {
    name: "asset-server-project-kinds",
    async resolveId(source, importer) {
      if (source === PROJECT_HANDLERS_MODULE_ID) {
        return kResolvedModuleId;
      }
      if (
        importer !== kResolvedModuleId ||
        !packageNames.has(source)
      ) {
        return null;
      }

      for (const projectImporter of kinds.resolver.importersOf(source)) {
        const resolved = await this.resolve(
          source,
          projectImporter,
          { skipSelf: true }
        );
        if (resolved !== null) {
          return resolved;
        }
      }

      return null;
    },
    load(id) {
      return id === kResolvedModuleId
        ? projectHandlersModule(kinds)
        : null;
    }
  };
}

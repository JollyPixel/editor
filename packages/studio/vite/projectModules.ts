// Import Third-party Dependencies
import type { Plugin } from "vite";
import {
  KINDS_EXPORT,
  type ProjectKinds
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import type { StudioProject } from "../server/StudioProject.ts";

// CONSTANTS
export const PROJECT_MODULE_ID = "virtual:jolly-pixel/project";
export const HANDLERS_MODULE_ID = "virtual:jolly-pixel/handlers";

export function projectModule(
  project: StudioProject
): string {
  const editors = project.editors.descriptors();
  const kinds = project.kinds.descriptors();

  return `export const editors = ${JSON.stringify(editors)};\n` +
    `export const kinds = ${JSON.stringify(kinds)};\n`;
}

export function handlersModule(
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

export function projectModulesPlugin(
  project: StudioProject
): Plugin {
  const modules = new Map([
    [`\0${PROJECT_MODULE_ID}`, () => projectModule(project)],
    [`\0${HANDLERS_MODULE_ID}`, () => handlersModule(project.kinds)]
  ]);

  return {
    name: "studio-project-modules",
    resolveId(id) {
      const resolved = `\0${id}`;

      return modules.has(resolved) ? resolved : null;
    },
    load(id) {
      return modules.get(id)?.() ?? null;
    }
  };
}

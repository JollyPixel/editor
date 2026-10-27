// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import type { Plugin } from "vite";
import {
  describeErrors,
  SchemaParser
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { PackageResolver } from "../project/PackageResolver.ts";
import type { ProjectKinds } from "../project/ProjectKinds.ts";

// CONSTANTS
export const PROJECT_CONTRIBUTIONS_MODULE_PREFIX = "virtual:jolly-pixel/contributions/";
const kResolvedPrefix = `\0${PROJECT_CONTRIBUTIONS_MODULE_PREFIX}`;
const kManifestFile = "package.json";
const kManifestParser = new SchemaParser(z.object({
  name: z.string(),
  jollypixel: z.optional(z.record(z.string(), z.unknown()))
}));

export interface ProjectContribution {
  name: string;
  specifier: string;
  manifest: string;
}

export interface ProjectContributionModule {
  name: string;
  id: string;
}

export function findProjectContributions(
  packages: Iterable<string>,
  resolver: PackageResolver,
  field: string
): ProjectContribution[] {
  const contributions: ProjectContribution[] = [];
  for (const packageName of new Set(packages)) {
    const manifestPath = path.join(resolver.locate(packageName), kManifestFile);
    const manifest = kManifestParser.parse(
      JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    );
    if (manifest.err) {
      throw new TypeError(
        `"${manifestPath}" is invalid: ${describeErrors(manifest.val)}`
      );
    }

    const { name, jollypixel = {} } = manifest.val;
    const subpath = jollypixel[field];
    if (subpath === undefined) {
      continue;
    }
    if (typeof subpath !== "string" || !subpath.startsWith("./")) {
      throw new TypeError(
        `"${name}" must name an export subpath in "jollypixel.${field}".`
      );
    }

    contributions.push({
      name,
      specifier: `${name}${subpath.slice(1)}`,
      manifest: manifestPath
    });
  }

  return contributions;
}

export function projectContributionsModule(
  modules: readonly ProjectContributionModule[]
): string {
  const imports = modules.map(({ id }, index) => (
    `import * as contribution${index} from ${JSON.stringify(id)};\n`
  ));
  const entries = modules.map(({ name }, index) => (
    `  { name: ${JSON.stringify(name)}, module: contribution${index} },\n`
  ));

  return `${imports.join("")}\n` +
    `export default [\n${entries.join("")}];\n`;
}

export function createProjectContributionsPlugin(
  kinds: ProjectKinds,
  editors: Iterable<string> = []
): Plugin {
  const editorPackages = [...editors];

  return {
    name: "asset-server-project-contributions",
    resolveId(source) {
      return source.startsWith(PROJECT_CONTRIBUTIONS_MODULE_PREFIX) ?
        `\0${source}` :
        null;
    },
    async load(id) {
      if (!id.startsWith(kResolvedPrefix)) {
        return null;
      }

      const contributions = findProjectContributions(
        [
          ...editorPackages,
          ...kinds.packages.map((kindPackage) => kindPackage.name)
        ],
        kinds.resolver,
        id.slice(kResolvedPrefix.length)
      );
      const modules = await Promise.all(
        contributions.map(async({ name, specifier, manifest }) => {
          const resolved = await this.resolve(
            specifier,
            manifest,
            { skipSelf: true }
          );
          if (resolved === null) {
            throw new TypeError(`Cannot resolve "${specifier}".`);
          }

          return {
            name,
            id: resolved.id
          };
        })
      );

      return projectContributionsModule(modules);
    }
  };
}

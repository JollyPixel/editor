// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import {
  createRequire,
  findPackageJSON
} from "node:module";

// Import Third-party Dependencies
import {
  defineSchema,
  describeErrors,
  SchemaParser
} from "@jolly-pixel/network";

// CONSTANTS
const kLocalSpecifier = /^\.\.?[\\/]/;
const kManifestFile = "package.json";
const kManifestParser = new SchemaParser(defineSchema({
  type: "object",
  properties: {
    name: { type: "string" },
    exports: {}
  }
}));

export interface PackageResolverOptions {
  fallbacks?: Iterable<string>;
}

export class PackageResolver {
  readonly root: string;
  readonly directories: readonly string[];

  static isLocal(
    specifier: string
  ): boolean {
    return kLocalSpecifier.test(specifier);
  }

  constructor(
    root: string,
    options: PackageResolverOptions = {}
  ) {
    const { fallbacks = [] } = options;

    this.root = path.resolve(root);
    this.directories = [
      this.root,
      ...Array.from(fallbacks, (directory) => path.resolve(directory))
    ];
  }

  locate(
    specifier: string
  ): string {
    if (PackageResolver.isLocal(specifier)) {
      const directory = path.resolve(this.root, specifier);
      if (!fs.existsSync(path.join(directory, kManifestFile))) {
        throw new TypeError(
          `Cannot locate the package "${specifier}" in "${this.root}".`
        );
      }

      return fs.realpathSync(directory);
    }

    for (const importer of this.importersOf(specifier)) {
      const manifest = findManifest(specifier, importer);
      if (manifest !== undefined) {
        return fs.realpathSync(path.dirname(manifest));
      }
    }

    throw new TypeError(`Cannot locate the package "${specifier}".`);
  }

  resolve(
    specifier: string
  ): string {
    if (PackageResolver.isLocal(specifier)) {
      return resolveFolder(this.locate(specifier));
    }

    let cause: unknown;
    for (const importer of this.importersOf(specifier)) {
      try {
        return createRequire(importer).resolve(specifier);
      }
      catch (error) {
        cause ??= error;
      }
    }

    throw new TypeError(
      `Cannot resolve the package "${specifier}".`,
      { cause }
    );
  }

  importersOf(
    specifier: string
  ): string[] {
    const directories = PackageResolver.isLocal(specifier) ?
      [this.root] :
      this.directories;

    return directories.map(
      (directory) => path.join(directory, kManifestFile)
    );
  }
}

function findManifest(
  specifier: string,
  importer: string
): string | undefined {
  try {
    return findPackageJSON(specifier, importer);
  }
  catch {
    return undefined;
  }
}

function resolveFolder(
  directory: string
): string {
  const manifestFile = path.join(directory, kManifestFile);
  const manifest = kManifestParser.parse(
    JSON.parse(fs.readFileSync(manifestFile, "utf8"))
  );
  if (manifest.err) {
    throw new TypeError(
      `"${manifestFile}" is invalid: ${describeErrors(manifest.val)}`
    );
  }

  const { name, exports } = manifest.val;
  const require = createRequire(manifestFile);

  return require.resolve(
    name !== undefined && exports !== undefined ? name : directory
  );
}

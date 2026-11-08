// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import {
  createRequire,
  findPackageJSON
} from "node:module";

// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kLocalSpecifier = /^\.\.?[\\/]/;
const kManifestFile = "package.json";
const kManifestSchema = z.object({
  name: z.optional(z.string()),
  exports: z.optional(z.unknown())
});
const kManifestParser = new SchemaParser(kManifestSchema);

export interface PackageResolverOptions {
  fallbacks?: Iterable<string>;
  searchFolders?: Iterable<string>;
}

export class PackageResolver {
  readonly root: string;
  readonly directories: readonly string[];
  readonly searchFolders: readonly string[];

  #searched: Map<string, string> | undefined;

  static isLocal(
    specifier: string
  ): boolean {
    return kLocalSpecifier.test(specifier);
  }

  constructor(
    root: string,
    options: PackageResolverOptions = {}
  ) {
    const {
      fallbacks = [],
      searchFolders = []
    } = options;

    this.root = path.resolve(root);
    this.directories = [
      this.root,
      ...Array.from(fallbacks, (directory) => path.resolve(directory))
    ];
    this.searchFolders = Array.from(
      searchFolders,
      (folder) => path.resolve(folder)
    );
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

    for (const importer of this.#importers(specifier)) {
      const manifest = findManifest(specifier, importer);
      if (manifest !== undefined) {
        return fs.realpathSync(path.dirname(manifest));
      }
    }

    const searched = this.#search(specifier);
    if (searched !== undefined) {
      return searched;
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
    for (const importer of this.#importers(specifier)) {
      try {
        return createRequire(importer).resolve(specifier);
      }
      catch (error) {
        cause ??= error;
      }
    }

    const searched = this.#search(specifier);
    if (searched !== undefined) {
      return resolveFolder(searched);
    }

    throw new TypeError(
      `Cannot resolve the package "${specifier}".`,
      { cause }
    );
  }

  findImporters(
    specifier: string
  ): string[] {
    const importers = this.#importers(specifier);
    const searched = PackageResolver.isLocal(specifier) ?
      undefined :
      this.#search(specifier);

    return searched === undefined ?
      importers :
      [...importers, path.join(searched, kManifestFile)];
  }

  #importers(
    specifier: string
  ): string[] {
    const directories = PackageResolver.isLocal(specifier) ?
      [this.root] :
      this.directories;

    return directories.map(
      (directory) => path.join(directory, kManifestFile)
    );
  }

  #search(
    packageName: string
  ): string | undefined {
    this.#searched ??= indexFolders(this.searchFolders);

    return this.#searched.get(packageName);
  }
}

function indexFolders(
  folders: Iterable<string>
): Map<string, string> {
  const packages = new Map<string, string>();
  for (const folder of folders) {
    const entries = fs.existsSync(folder) ?
      fs.readdirSync(folder, { withFileTypes: true }) :
      [];
    for (const entry of entries) {
      const directory = path.join(folder, entry.name);
      const manifestFile = path.join(directory, kManifestFile);
      if (!entry.isDirectory() || !fs.existsSync(manifestFile)) {
        continue;
      }

      const { name } = readManifest(manifestFile);
      if (name !== undefined && !packages.has(name)) {
        packages.set(name, fs.realpathSync(directory));
      }
    }
  }

  return packages;
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
  const { name, exports } = readManifest(manifestFile);
  const require = createRequire(manifestFile);

  return require.resolve(
    name !== undefined && exports !== undefined ? name : directory
  );
}

function readManifest(
  manifestFile: string
): z.infer<typeof kManifestSchema> {
  const manifest = kManifestParser.parse(
    JSON.parse(fs.readFileSync(manifestFile, "utf8"))
  );
  if (manifest.err) {
    throw new TypeError(
      `"${manifestFile}" is invalid: ${describeErrors(manifest.val)}`
    );
  }

  return manifest.val;
}

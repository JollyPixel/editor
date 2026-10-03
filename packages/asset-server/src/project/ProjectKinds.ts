// Import Node.js Dependencies
import { pathToFileURL } from "node:url";

// Import Internal Dependencies
import type { AssetKindDescriptor } from "../kinds/AssetKindDescriptor.ts";
import type { AssetKindHandler } from "../kinds/AssetKindHandler.ts";
import { BINARY_KIND } from "../kinds/handlers/binary.ts";
import {
  builtInAssetKinds,
  BUILT_IN_KINDS_PACKAGE
} from "../kinds/handlers/builtIn.ts";
import {
  KindPackage,
  type PackageLoader
} from "./KindPackage.ts";
import { PackageResolver } from "./PackageResolver.ts";
import type { ProjectFile } from "./ProjectFile.ts";

export interface ProjectKindsLoadOptions {
  /**
   * @default new PackageResolver(file.root)
   */
  resolver?: PackageResolver;
  /**
   * @default imports the file `resolver` resolves
   */
  load?: PackageLoader;
}

export class ProjectKinds {
  readonly packages: readonly KindPackage[];
  readonly resolver: PackageResolver;

  static async load(
    file: ProjectFile,
    options: ProjectKindsLoadOptions = {}
  ): Promise<ProjectKinds> {
    const {
      resolver = new PackageResolver(file.root),
      load = (packageName) => import(
        pathToFileURL(resolver.resolve(packageName)).href
      )
    } = options;
    const packages = await Promise.all(
      Array.from(
        file.kinds,
        ([name, kindOptions]) => KindPackage.load(name, kindOptions, load)
      )
    );

    return new ProjectKinds(packages, resolver);
  }

  constructor(
    packages: Iterable<KindPackage>,
    resolver: PackageResolver
  ) {
    const list = [...packages];
    const owners = new Map<string, string>(
      [
        BINARY_KIND,
        ...builtInAssetKinds().map((handler) => handler.kind)
      ].map((kind) => [kind, BUILT_IN_KINDS_PACKAGE])
    );
    for (const kindPackage of list) {
      for (const { kind } of kindPackage.handlers) {
        const owner = owners.get(kind);
        if (owner !== undefined) {
          throw new TypeError(
            `Asset kind "${kind}" is declared by both "${owner}" and "${kindPackage.name}".`
          );
        }
        owners.set(kind, kindPackage.name);
      }
    }

    this.packages = list;
    this.resolver = resolver;
  }

  handlers(): AssetKindHandler[] {
    return [
      ...this.packages.flatMap((kindPackage) => kindPackage.handlers),
      ...builtInAssetKinds()
    ];
  }

  descriptors(): AssetKindDescriptor[] {
    return this.packages.flatMap((kindPackage) => kindPackage.descriptors);
  }
}

// Import Node.js Dependencies
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import {
  findProjectContributions,
  PackageResolver
} from "@jolly-pixel/asset-server/node";
import {
  GOLEM_KINDS_EXPORT,
  type GolemAsset,
  type GolemKind,
  type GolemKindContribution
} from "@jolly-pixel/golem.kit";
import type { KindPackageDescriptor } from "@jolly-pixel/server";

// Import Internal Dependencies
import { UnsupportedKindError } from "./errors/UnsupportedKindError.ts";
import { PACKAGE_ROOT } from "../packageRoot.ts";

// CONSTANTS
const kGolemField = "golem";

export type AnyGolemKind = GolemKindContribution<GolemAsset>;

interface KindPackageLoad {
  contributions: AnyGolemKind[];
  failures: [kind: string, cause: unknown][];
}

export class GolemKinds {
  static async load(
    kindPackages: Iterable<KindPackageDescriptor>,
    projectRoot: string
  ): Promise<GolemKinds> {
    const resolver = new PackageResolver(projectRoot, {
      fallbacks: [PACKAGE_ROOT],
      searchFolders: [path.join(PACKAGE_ROOT, "..", "assets")]
    });
    const loads = await Promise.all(Array.from(
      kindPackages,
      (kindPackage) => loadKindPackage(kindPackage, resolver)
    ));

    return new GolemKinds(
      loads.flatMap((load) => load.contributions),
      loads.flatMap((load) => load.failures)
    );
  }

  #contributions: ReadonlyMap<string, AnyGolemKind>;
  #failures: ReadonlyMap<string, unknown>;

  constructor(
    contributions: Iterable<AnyGolemKind>,
    failures: Iterable<[kind: string, cause: unknown]> = []
  ) {
    this.#contributions = new Map(
      Array.from(contributions, (contribution) => [contribution.kind, contribution])
    );
    this.#failures = new Map(failures);
  }

  has(
    kind: string
  ): kind is GolemKind {
    return this.#contributions.has(kind);
  }

  names(): string[] {
    return [...this.#contributions.keys()];
  }

  contribution(
    kind: string
  ): AnyGolemKind {
    const contribution = this.#contributions.get(kind);
    if (contribution === undefined) {
      const failure = this.#failures.get(kind);

      throw new UnsupportedKindError(
        kind,
        this.names(),
        failure === undefined ? undefined : { cause: failure }
      );
    }

    return contribution;
  }
}

async function loadKindPackage(
  kindPackage: KindPackageDescriptor,
  resolver: PackageResolver
): Promise<KindPackageLoad> {
  try {
    return {
      contributions: await importContributions(kindPackage.name, resolver),
      failures: []
    };
  }
  catch (error) {
    return {
      contributions: [],
      failures: kindPackage.kinds.map((kind) => [kind, error])
    };
  }
}

async function importContributions(
  packageName: string,
  resolver: PackageResolver
): Promise<AnyGolemKind[]> {
  const [entry] = findProjectContributions([packageName], resolver, kGolemField);
  if (entry === undefined) {
    return [];
  }

  const file = createRequire(entry.manifest).resolve(entry.specifier);
  const module: Record<string, unknown> = await import(pathToFileURL(file).href);
  const contributions = module[GOLEM_KINDS_EXPORT];
  if (!Array.isArray(contributions) || !contributions.every(isContribution)) {
    throw new TypeError(
      `"${entry.specifier}" does not export "${GOLEM_KINDS_EXPORT}".`
    );
  }

  return contributions;
}

function isContribution(
  value: unknown
): value is AnyGolemKind {
  return typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof value.kind === "string" &&
    "open" in value &&
    typeof value.open === "function" &&
    "schema" in value &&
    "intents" in value &&
    typeof value.intents === "object";
}

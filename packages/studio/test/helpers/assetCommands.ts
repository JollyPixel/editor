// Import Third-party Dependencies
import {
  CATALOG_PLAN,
  CatalogRejectedError,
  type CatalogBatchReport,
  type ImportConflictPolicy,
  type ImportFailure,
  type ImportPlan
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { DroppedFile } from "../../src/browser/DroppedFile.ts";
import {
  AssetCommands,
  type AssetCommandCatalog
} from "../../src/shell/assets/AssetCommands.ts";

export interface CommandsProbe {
  commands: AssetCommands;
  errors: string[];
  calls: string[];
  lists: string[];
  created: Parameters<AssetCommandCatalog["create"]>[];
  imports: ImportConflictPolicy[];
}

export interface ArchiveFixture {
  plan: ImportPlan | Error;
  failed?: ImportFailure[];
}

export function commandsFailingAt(
  failAt: number,
  archive: ArchiveFixture = {
    plan: new CatalogRejectedError("not an asset archive", CATALOG_PLAN)
  }
): CommandsProbe {
  const imports: ImportConflictPolicy[] = [];
  const calls: string[] = [];
  async function call(
    name: string,
    target: string
  ): Promise<void> {
    calls.push(`${name} ${target}`);
    if (calls.length - 1 === failAt) {
      throw new Error("disk full");
    }
  }
  const lists: string[] = [];
  async function callEach(
    name: string,
    targets: string[]
  ): Promise<CatalogBatchReport> {
    if (targets.length === 0) {
      return { applied: 0 };
    }
    lists.push(`${name} ${targets.length}`);
    let applied = 0;
    for (const target of targets) {
      try {
        await call(name, target);
      }
      catch (error) {
        return {
          applied,
          failure: (error as Error).message
        };
      }
      applied++;
    }

    return { applied };
  }
  const created: Parameters<AssetCommandCatalog["create"]>[] = [];
  const catalog: AssetCommandCatalog = {
    create: async(...args) => {
      created.push(args);
      await call("create", args[0]);

      return "created";
    },
    renameMany: (renames) => callEach(
      "rename",
      Array.from(renames, (rename) => rename.assetId)
    ),
    removeMany: (assetIds) => callEach("remove", [...assetIds]),
    createFolder: async(path) => {
      await call("createFolder", path);

      return path;
    },
    moveFolder: async(from, to) => {
      await call("moveFolder", `${from} ${to}`);

      return to;
    },
    removeFolder: (path) => call("removeFolder", path),
    exportArchive: async() => new Uint8Array(),
    planImport: async() => {
      if (archive.plan instanceof Error) {
        throw archive.plan;
      }

      return archive.plan;
    },
    importArchive: async(_content, options) => {
      imports.push(options.onConflict);

      return {
        created: [],
        replaced: [],
        kept: [],
        failed: archive.failed ?? []
      };
    }
  };
  const errors: string[] = [];

  return {
    commands: new AssetCommands({
      catalog,
      onError: (message) => errors.push(message)
    }),
    errors,
    calls,
    lists,
    created,
    imports
  };
}

export function droppedFile(
  name: string,
  content = "bytes"
): DroppedFile {
  return new DroppedFile(new File([content], name));
}

export function importPlan(
  live: number
): ImportPlan {
  return {
    live: Array.from({ length: live }, (_, index) => {
      return {
        id: `live-${index}`,
        kind: "pixelart",
        path: `sprites/${index}.pixelart`
      };
    }),
    fresh: [],
    sharedDependents: [],
    incompatible: []
  };
}

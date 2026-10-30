// Import Third-party Dependencies
import {
  DependencyIndex,
  type CatalogCreateOptions,
  type ImportConflictPolicy,
  type ImportPlan,
  type ImportReport
} from "@jolly-pixel/asset-server/client";
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  EditorArchives,
  type EditorArchiveBrowser,
  type EditorArchiveCatalog,
  type EditorArchiveTarget
} from "#src/session/EditorArchives.ts";
import type {
  SessionArchive,
  SessionArchiveImportOptions
} from "#src/session/SessionArchive.ts";
import type { EditorToolbarArchives } from "#src/session/EditorToolbarSources.ts";
import type { OfflineMode } from "#src/connection/OfflineMode.ts";
import type { LaunchNavigator } from "#src/launch/LaunchNavigator.ts";
import { FakeNavigator } from "./catalog.ts";

// CONSTANTS
export const ARCHIVE_KIND = "voxelmodel";
export const RESET_WARNING = "Everything is deleted.";
export const ARCHIVE_ROOT: AssetReferenceData = {
  id: "model-2",
  kind: ARCHIVE_KIND
};
export const LIVE_ENTRY = {
  ...ARCHIVE_ROOT,
  path: "models/robot.voxelmodel.json"
};
export const TARGET_ID = "model-1";
export const DEPENDENCY_KIND = {
  kind: "voxelanimation",
  extension: ".voxelanim.json",
  folder: "animations/"
};
export const DEPENDENCY_ROOT: AssetReferenceData = {
  id: "walk",
  kind: DEPENDENCY_KIND.kind
};

export function archiveFile(): File {
  return new File(["zip"], "robot.zip");
}

export interface CreatedAsset {
  path: string;
  text: string;
  options: CatalogCreateOptions | undefined;
}

export class FakeArchiveCatalog implements EditorArchiveCatalog {
  readonly dependencies = new DependencyIndex();
  readonly created: CreatedAsset[] = [];
  readonly #records: AssetRecordData[];

  constructor(
    records: AssetRecordData[] = []
  ) {
    this.#records = records;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.find((record) => record.id === assetId);
  }

  create(
    path: string,
    content: Uint8Array | null,
    options?: CatalogCreateOptions
  ): Promise<string> {
    this.created.push({
      path,
      text: new TextDecoder().decode(content ?? new Uint8Array()),
      options
    });

    return Promise.resolve(`created-${this.created.length}`);
  }
}

export interface FakeArchive extends SessionArchive {
  exported: Array<string | undefined>;
  imported: SessionArchiveImportOptions[];
}

export interface FakeArchiveOptions {
  canImport?: boolean;
  root?: AssetReferenceData;
  live?: ImportPlan["live"];
  replaced?: ImportReport["replaced"];
}

export interface FakeBrowser extends EditorArchiveBrowser {
  saved: Array<{ fileName: string; text: Promise<string>; }>;
  asked: ImportPlan[];
  confirmed: string[];
  assigned: string[];
  reloads: number;
  picks: string[];
}

export interface FakeBrowserOptions {
  policy?: ImportConflictPolicy | null;
  confirm?: boolean;
  picked?: File | null;
}

export function createArchive(
  options: FakeArchiveOptions = {}
): FakeArchive {
  const {
    canImport = true,
    live = [],
    replaced = []
  } = options;
  const root = "root" in options ? options.root : ARCHIVE_ROOT;

  const exported: Array<string | undefined> = [];
  const imported: SessionArchiveImportOptions[] = [];

  return {
    canImport,
    exported,
    imported,
    export(assetId) {
      exported.push(assetId);

      return Promise.resolve(new Blob(["zip"]));
    },
    plan() {
      const plan: ImportPlan = {
        root,
        live,
        fresh: [],
        sharedDependents: [],
        incompatible: []
      };

      return Promise.resolve(plan);
    },
    import(_file, importOptions) {
      imported.push(importOptions);
      const report: ImportReport = {
        root,
        created: [],
        replaced,
        kept: [],
        failed: []
      };

      return Promise.resolve(report);
    }
  };
}

export function createBrowser(
  options: FakeBrowserOptions = {}
): FakeBrowser {
  const {
    policy = "replace",
    confirm = true,
    picked = archiveFile()
  } = options;

  const browser: FakeBrowser = {
    saved: [],
    asked: [],
    confirmed: [],
    assigned: [],
    reloads: 0,
    picks: [],
    location: {
      href: "http://localhost:5173/?target=model-1&room=a",
      assign(url) {
        browser.assigned.push(String(url));
      },
      reload() {
        browser.reloads++;
      }
    },
    pickFile(accept) {
      browser.picks.push(accept);

      return Promise.resolve(picked);
    },
    save(blob, fileName) {
      browser.saved.push({
        fileName,
        text: blob.text()
      });
    },
    askConflictPolicy(plan) {
      browser.asked.push(plan);

      return Promise.resolve(policy);
    },
    confirmReset(message) {
      browser.confirmed.push(message);

      return Promise.resolve(confirm);
    }
  };

  return browser;
}

export interface CreateArchivesOptions {
  archive?: SessionArchive;
  browser?: EditorArchiveBrowser;
  offline?: OfflineMode | null;
  target?: EditorArchiveTarget;
  navigator?: LaunchNavigator;
  catalog?: EditorArchiveCatalog;
}

export function createArchives(
  options: CreateArchivesOptions = {}
): EditorArchives {
  const {
    archive = createArchive(),
    browser = createBrowser(),
    offline = null,
    navigator = new FakeNavigator(),
    catalog = new FakeArchiveCatalog(),
    target = {
      id: TARGET_ID,
      path: "models/robot.voxelmodel.json"
    }
  } = options;

  return new EditorArchives({
    session: {
      archive,
      offline,
      targetRecord: target,
      catalog
    },
    accepts: ARCHIVE_KIND,
    fallbackName: "model",
    resetWarning: RESET_WARNING,
    navigator,
    browser
  });
}

export function createOfflineMode(
  overrides: Partial<OfflineMode> = {}
): OfflineMode & { resets: number; } {
  const offline = {
    persistent: true,
    resets: 0,
    reset() {
      offline.resets++;

      return Promise.resolve();
    },
    ...overrides
  };

  return offline;
}

export interface FakeToolbarArchives extends EditorToolbarArchives {
  calls: string[];
}

export interface FakeToolbarArchivesOptions {
  canImport?: boolean;
  canReset?: boolean;
  dependencies?: AssetRecordData[];
}

export function createToolbarArchives(
  options: FakeToolbarArchivesOptions = {}
): FakeToolbarArchives {
  const {
    canImport = true,
    canReset = false,
    dependencies = []
  } = options;
  const calls: string[] = [];
  function call(
    name: string
  ): () => Promise<void> {
    return () => {
      calls.push(name);

      return Promise.resolve();
    };
  }

  return {
    canImport,
    canReset,
    calls,
    dependencies,
    download: call("download"),
    downloadAsset(assetId) {
      calls.push(`download ${assetId}`);

      return Promise.resolve();
    },
    pickAndImport: call("import"),
    reset: call("reset")
  };
}

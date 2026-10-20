// Import Third-party Dependencies
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "@jolly-pixel/asset-server/client";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  EditorArchives,
  type EditorArchiveBrowser,
  type EditorArchiveTarget
} from "#src/session/EditorArchives.ts";
import type {
  SessionArchive,
  SessionArchiveImportOptions
} from "#src/session/SessionArchive.ts";
import type { OfflineMode } from "#src/session/OfflineMode.ts";

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

export interface FakeArchive extends SessionArchive {
  exported: Array<string | undefined>;
  imported: SessionArchiveImportOptions[];
}

export interface FakeArchiveOptions {
  canImport?: boolean;
  root?: AssetReferenceData;
  live?: ImportPlan["live"];
}

export interface FakeBrowser extends EditorArchiveBrowser {
  saved: Array<{ fileName: string; text: Promise<string>; }>;
  asked: ImportPlan[];
  confirmed: string[];
  assigned: string[];
  reloads: number;
  picks: number;
}

export interface FakeBrowserOptions {
  policy?: ImportConflictPolicy | null;
  confirm?: boolean;
  picked?: Blob | null;
}

export function createArchive(
  options: FakeArchiveOptions = {}
): FakeArchive {
  const {
    canImport = true,
    live = []
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
        replaced: [],
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
    picked = new Blob(["zip"])
  } = options;

  const browser: FakeBrowser = {
    saved: [],
    asked: [],
    confirmed: [],
    assigned: [],
    reloads: 0,
    picks: 0,
    location: {
      href: "http://localhost:5173/?target=model-1&room=a",
      assign(url) {
        browser.assigned.push(String(url));
      },
      reload() {
        browser.reloads++;
      }
    },
    pickArchive() {
      browser.picks++;

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
}

export function createArchives(
  options: CreateArchivesOptions = {}
): EditorArchives {
  const {
    archive = createArchive(),
    browser = createBrowser(),
    offline = null,
    target = {
      id: "model-1",
      source: "models/robot.voxelmodel.json"
    }
  } = options;

  return new EditorArchives({
    archive,
    offline,
    accepts: ARCHIVE_KIND,
    fallbackName: "model",
    resetWarning: RESET_WARNING,
    target: () => target,
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

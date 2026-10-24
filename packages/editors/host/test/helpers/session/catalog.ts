// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  AssetTag,
  CatalogClientEvents,
  RestoreReport
} from "@jolly-pixel/asset-server/client";
import type { ConfirmOptions } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LaunchNavigator } from "#src/launch/LaunchNavigator.ts";
import {
  EditorTags,
  type EditorTagsBrowser
} from "#src/session/EditorTags.ts";
import type { NewTag } from "#src/session/dialogs/askNewTag.ts";

// CONSTANTS
export const TAGGED_ASSET_ID = "forest";

export class FakeSessionCatalog extends Emitter<CatalogClientEvents> {
  assets: AssetRecordData[];
  stored: AssetTag[] = [];
  readonly dependents = new Map<string, AssetRecordData[]>();
  readonly calls: string[] = [];

  constructor(
    assets: AssetRecordData[] = []
  ) {
    super();
    this.assets = assets;
  }

  records(): IterableIterator<AssetRecordData> {
    return this.assets.values();
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.assets.find((asset) => asset.id === assetId);
  }

  listDependents(
    assetId: string
  ): AssetRecordData[] {
    return this.dependents.get(assetId) ?? [];
  }

  rename(
    assetId: string,
    to: string
  ): Promise<void> {
    this.calls.push(`rename ${assetId} ${to}`);
    this.assets = this.assets.map((asset) => (asset.id === assetId ?
      { ...asset, path: to } :
      asset));
    this.emit("change");

    return Promise.resolve();
  }

  remove(
    assetId: string
  ): Promise<void> {
    this.calls.push(`remove ${assetId}`);
    this.assets = this.assets.filter((asset) => asset.id !== assetId);
    this.emit("change");

    return Promise.resolve();
  }

  tags(): Promise<readonly AssetTag[]> {
    return Promise.resolve(this.stored);
  }

  tag(
    assetId: string,
    name: string,
    message?: string
  ): Promise<AssetTag> {
    this.calls.push(`tag ${assetId} ${name} ${message ?? "-"}`);

    return Promise.resolve(assetTag(name, 9));
  }

  untag(
    assetId: string,
    name: string
  ): Promise<void> {
    this.calls.push(`untag ${assetId} ${name}`);

    return Promise.resolve();
  }

  restore(
    assetId: string,
    name: string
  ): Promise<RestoreReport> {
    this.calls.push(`restore ${assetId} ${name}`);

    return Promise.resolve({
      restored: true,
      missing: []
    });
  }
}

export interface Navigation {
  target: string;
  tag: string | null;
}

export class FakeNavigator implements LaunchNavigator {
  readonly navigations: Navigation[] = [];

  navigate(
    target: string,
    tag: string | null
  ): Promise<void> {
    this.navigations.push({
      target,
      tag
    });

    return Promise.resolve();
  }
}

export interface FakeTagsBrowser extends EditorTagsBrowser {
  readonly confirmed: string[];
}

export interface FakeTagsOptions {
  viewing?: string | null;
  confirm?: boolean;
  newTag?: NewTag | null;
  unsaved?: boolean;
}

export function assetTag(
  name: string,
  eventVersion: number
): AssetTag {
  return {
    assetId: TAGGED_ASSET_ID,
    name,
    actor: {
      type: "user",
      id: "alice"
    },
    createdAt: "2026-10-12T00:00:00.000Z",
    eventVersion,
    path: "forest.voxelmap",
    hash: "hash",
    size: 1
  };
}

export function fakeTags(
  options: FakeTagsOptions = {}
) {
  const {
    viewing = null,
    confirm = true,
    newTag = null,
    unsaved = false
  } = options;
  const catalog = new FakeSessionCatalog();
  const browser: FakeTagsBrowser = {
    confirmed: [],
    askNewTag: () => Promise.resolve(newTag),
    confirm: (confirmOptions: ConfirmOptions) => {
      browser.confirmed.push(confirmOptions.message);

      return Promise.resolve(confirm);
    }
  };
  const navigator = new FakeNavigator();
  const tags = new EditorTags({
    catalog,
    assetId: TAGGED_ASSET_ID,
    viewing,
    unsaved: () => unsaved,
    navigator,
    browser
  });

  return {
    catalog,
    browser,
    navigator,
    tags
  };
}

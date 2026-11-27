// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AccountActivity } from "@jolly-pixel/accounts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE_FOLDER,
  CATALOG_MOVE_FOLDER,
  CATALOG_TAG,
  CATALOG_UNTAG,
  type AssetEvent,
  type CatalogActivityEntry
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  AuditCategory,
  AuditRow
} from "../api.ts";
import type { SettingsSectionName } from "../../project/api.ts";

// CONSTANTS
export const ENTRY_CATEGORIES = {
  edits: "edits",
  asset: "structure",
  tag: "structure",
  folder: "structure",
  account: "accounts",
  settings: "settings"
} as const satisfies Record<AuditEntry["type"], AuditCategory>;
const kNoVersions: EditVersions = {
  from: null,
  to: null
};

type RowAction<TType extends AuditRow["type"]> = Extract<
  AuditRow,
  { type: TType; action: string; }
>["action"];

export interface SettingsChange {
  section: SettingsSectionName;
  before: unknown;
  after: unknown;
}

export interface EditVersions {
  from: number | null;
  to: number | null;
}

export interface EditRunEntry {
  type: "edits";
  actor: EventStore.Actor;
  assetId: string;
  count: number;
  from: number;
  to: number;
  versions: EditVersions;
  summary: string | null;
}

export interface AssetEntry {
  type: "asset";
  at: number;
  actor: EventStore.Actor;
  assetId: string;
  action: RowAction<"asset">;
  path: string | null;
  previousPath?: string;
  tag?: string;
}

export interface TagEntry {
  type: "tag";
  at: number;
  actor: EventStore.Actor;
  assetId: string;
  action: RowAction<"tag">;
  name: string;
  message?: string;
}

export interface FolderEntry {
  type: "folder";
  at: number;
  actor: EventStore.Actor;
  action: RowAction<"folder">;
  path: string;
  previousPath?: string;
}

export interface AccountEntry {
  type: "account";
  at: number;
  actor: EventStore.Actor;
  activity: AccountActivity;
}

export interface SettingsEntry {
  type: "settings";
  at: number;
  actor: EventStore.Actor;
  change: SettingsChange;
}

export type AuditEntry =
  | EditRunEntry
  | AssetEntry
  | TagEntry
  | FolderEntry
  | AccountEntry
  | SettingsEntry;

export interface AuditRecord {
  id: number;
  entry: AuditEntry;
}

export function actorKey(
  actor: EventStore.Actor
): string {
  return actor.type === "user" ?
    `user:${actor.id}` :
    `system:${actor.source}`;
}

export function entryAssetId(
  entry: AuditEntry
): string | null {
  return "assetId" in entry ? entry.assetId : null;
}

export function entrySpan(
  entry: AuditEntry | AuditRow
): { start: number; end: number; } {
  return entry.type === "edits" ?
    { start: entry.from, end: entry.to } :
    { start: entry.at, end: entry.at };
}

export function entryVersions(
  entry: AuditEntry
): EditVersions {
  return entry.type === "edits" ? entry.versions : kNoVersions;
}

export function assetEntry(
  event: AssetEvent
): AssetEntry {
  const asset = {
    type: "asset",
    at: Date.parse(event.createdAt),
    actor: event.actor,
    assetId: event.assetId
  } as const;
  switch (event.eventType) {
    case ASSET_CREATED:
      return { ...asset, action: "created", path: event.eventData.path };
    case ASSET_UPDATED: {
      const { path, restoredFrom } = event.eventData;

      return restoredFrom === undefined ?
        { ...asset, action: "replaced", path } :
        { ...asset, action: "restored", path, tag: restoredFrom.name };
    }
    case ASSET_DELETED:
      return { ...asset, action: "deleted", path: event.eventData.path };
    case ASSET_RENAMED:
      return {
        ...asset,
        action: "renamed",
        path: event.eventData.to,
        previousPath: event.eventData.from
      };
    default:
      return event satisfies never;
  }
}

export function catalogEntry(
  activity: CatalogActivityEntry,
  at = Date.now()
): FolderEntry | TagEntry | null {
  const { applied, actor } = activity;
  switch (applied.command) {
    case CATALOG_CREATE_FOLDER:
    case CATALOG_DELETE_FOLDER:
      return {
        type: "folder",
        at,
        actor,
        action: applied.command === CATALOG_CREATE_FOLDER ? "created" : "deleted",
        path: applied.path
      };
    case CATALOG_MOVE_FOLDER:
      return {
        type: "folder",
        at,
        actor,
        action: "moved",
        path: applied.path,
        previousPath: applied.from
      };
    case CATALOG_TAG:
      return {
        type: "tag",
        at,
        actor,
        action: "created",
        assetId: applied.tag.assetId,
        name: applied.tag.name,
        ...(applied.tag.message === undefined ? {} : { message: applied.tag.message })
      };
    case CATALOG_UNTAG:
      return {
        type: "tag",
        at,
        actor,
        action: "deleted",
        assetId: applied.assetId,
        name: applied.name
      };
    default:
      return null;
  }
}

export function settingsEntry(
  actor: EventStore.Actor,
  change: SettingsChange,
  at = Date.now()
): SettingsEntry {
  return {
    type: "settings",
    at,
    actor,
    change
  };
}

export function accountEntry(
  activity: AccountActivity,
  at = Date.now()
): AccountEntry {
  return {
    type: "account",
    at,
    actor: {
      type: "user",
      id: activity.actorId
    },
    activity
  };
}

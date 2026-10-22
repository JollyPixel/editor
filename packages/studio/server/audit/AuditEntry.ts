// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { AccountActivity } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type {
  AuditCategory,
  AuditRow
} from "../../shared/api/audit.ts";
import type { SettingsSectionName } from "../../shared/api/project.ts";

// CONSTANTS
export const ENTRY_CATEGORIES = {
  edit: "edits",
  asset: "structure",
  tag: "structure",
  account: "accounts",
  settings: "settings"
} as const satisfies Record<AuditEntry["kind"], AuditCategory>;

export type AuditSourceName = "events" | "audit" | "tags";

export interface SettingsChange {
  section: SettingsSectionName;
  before: unknown;
  after: unknown;
}

export interface EditEntry {
  kind: "edit";
  at: number;
  actor: EventStore.Actor;
  assetId: string;
}

export type AuditEntry =
  | EditEntry
  | {
    kind: "asset";
    at: number;
    actor: EventStore.Actor;
    assetId: string;
    action: Extract<AuditRow, { type: "asset"; }>["action"];
    path: string | null;
    previousPath?: string;
  }
  | {
    kind: "tag";
    at: number;
    actor: EventStore.Actor;
    assetId: string;
    name: string;
    message?: string;
  }
  | {
    kind: "account";
    at: number;
    actor: EventStore.Actor;
    activity: AccountActivity;
  }
  | {
    kind: "settings";
    at: number;
    actor: EventStore.Actor;
    change: SettingsChange;
  };

export interface AuditItem {
  position: number | string;
  at: number;
  entry: AuditEntry | null;
}

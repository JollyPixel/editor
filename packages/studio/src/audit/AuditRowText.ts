// Import Internal Dependencies
import type {
  AuditAccountActivity,
  AuditAsset,
  AuditRow
} from "./routes.ts";
import type { SettingsSectionName } from "../project/routes.ts";

// CONSTANTS
const kSectionLabels: Readonly<Record<SettingsSectionName, string>> = {
  kinds: "the editor settings",
  access: "the access settings"
};

export class AuditRowText {
  readonly actor: string;
  readonly action: string;
  readonly at: number;
  readonly detail: string | null;

  constructor(
    row: AuditRow
  ) {
    this.actor = row.actor.name;
    this.at = row.type === "edits" ? row.to : row.at;
    this.action = action(row);
    this.detail = detail(row);
  }
}

function action(
  row: AuditRow
): string {
  switch (row.type) {
    case "edits":
      return `edited ${assetLabel(row.asset)}`;
    case "asset":
      return row.action === "renamed" && row.previousPath !== undefined ?
        `renamed ${row.previousPath} to ${assetLabel(row.asset)}` :
        `${row.action} ${assetLabel(row.asset)}`;
    case "tag":
      return `tagged ${assetLabel(row.asset)} "${row.name}"`;
    case "settings":
      return `changed ${kSectionLabels[row.section]}`;
    case "account":
      return accountAction(row.activity);
    default:
      return row satisfies never;
  }
}

function detail(
  row: AuditRow
): string | null {
  switch (row.type) {
    case "edits":
      return `${row.count} ${row.count === 1 ? "change" : "changes"} over ${duration(row.to - row.from)}`;
    case "tag":
      return row.message ?? null;
    default:
      return null;
  }
}

function accountAction(
  activity: AuditAccountActivity
): string {
  switch (activity.type) {
    case "registered":
      return activity.pending ? "requested access" : "registered";
    case "approved":
      return `approved ${activity.username} as ${activity.role}`;
    case "denied":
      return `denied ${activity.username}`;
    case "role-changed":
      return `changed the role of ${activity.username}: ${activity.from} → ${activity.to}`;
    case "owner-transferred":
      return `made ${activity.username} the owner`;
    case "removed":
      return `removed ${activity.username}`;
    case "share-link-created":
      return `created a share link to ${assetLabel(activity.asset)}`;
    case "share-link-revoked":
      return `revoked a share link to ${assetLabel(activity.asset)}`;
    default:
      return activity satisfies never;
  }
}

function assetLabel(
  asset: AuditAsset
): string {
  return asset.path ?? asset.id;
}

function duration(
  milliseconds: number
): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) {
    return "less than a minute";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

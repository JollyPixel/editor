// Import Third-party Dependencies
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";
import {
  AUDIT_RIGHT,
  EXPORT_RIGHT,
  SETTINGS_RIGHT,
  SHARE_RIGHT
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { AssetKindEntry } from "../catalog/AssetKindSet.ts";
import {
  KeyRow,
  NamedRow
} from "./permissions/KeyRow.ts";
import type { PermissionRow } from "./permissions/PermissionRow.ts";
import { RoomRow } from "./permissions/RoomRow.ts";

// CONSTANTS
const kProjectRows: readonly PermissionRow[] = [
  new RoomRow(CATALOG_ROOM, {
    label: "Assets",
    description: "Read lists the assets; write also creates, renames, moves and deletes them"
  }),
  new KeyRow(SHARE_RIGHT, ["void", "write"], {
    label: "Share links",
    description: "Creates links that open one asset"
  }),
  new KeyRow(EXPORT_RIGHT, ["void", "write"], {
    label: "Export",
    description: "Exports the game"
  }),
  new NamedRow(SETTINGS_RIGHT, ["void", "read", "write"], {
    label: "Settings",
    description: "Read sees the project settings; write also edits them. Only this exact rule grants it"
  }),
  new NamedRow(AUDIT_RIGHT, ["void", "read"], {
    label: "Audit",
    description: "Sees the project's audit log. Only this exact rule grants it"
  })
];

export class CapabilityCatalog {
  readonly project = kProjectRows;
  readonly kinds: readonly RoomRow[];
  readonly eventKeys: readonly string[];

  constructor(
    kinds: Iterable<AssetKindEntry>
  ) {
    this.kinds = Array.from(kinds, (entry) => new RoomRow(entry.kind, {
      label: entry.label,
      icon: entry.icon,
      capabilities: entry.capabilities
    }));
    this.eventKeys = [
      ...this.project,
      ...this.kinds.flatMap((kind) => [kind, ...kind.capabilities])
    ].flatMap((row) => row.keys);
  }
}

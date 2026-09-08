// Import Internal Dependencies
import type { Event } from "../../EventStore.ts";
import { materializeEvent } from "../serialize.ts";

export interface EventRow {
  event_id: number;
  asset_type: string;
  asset_id: string;
  event_type: string;
  event_data: string;
  event_version: number;
  actor: string;
  created_at: string;
}

// CONSTANTS
const kColumnNames = [
  "event_id",
  "asset_type",
  "asset_id",
  "event_type",
  "event_data",
  "event_version",
  "actor",
  "created_at"
];

export const EVENT_COLUMNS = kColumnNames.join(", ");
export const ALIASED_EVENT_COLUMNS = kColumnNames
  .map((column) => `e.${column}`)
  .join(", ");

export function toEvent(
  row: EventRow
): Event {
  return materializeEvent({
    eventId: row.event_id,
    assetType: row.asset_type,
    assetId: row.asset_id,
    eventType: row.event_type,
    eventDataJson: row.event_data,
    eventVersion: row.event_version,
    actorJson: row.actor,
    createdAt: row.created_at
  });
}

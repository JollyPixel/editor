// Import Internal Dependencies
import {
  ENTRY_CATEGORIES,
  entrySpan
} from "./AuditEntry.ts";
import type {
  AuditAsset,
  AuditRow
} from "../api.ts";

// CONSTANTS
const kFormulaStart = /^[=+\-@\t\r]/;
const kNeedsQuotes = /[",\r\n]/;
const kHeader = [
  "Started",
  "Ended",
  "Actor",
  "Actor kind",
  "Category",
  "Event",
  "Asset",
  "Details"
];

export function* auditCsv(
  rows: Iterable<AuditRow>
): IterableIterator<string> {
  yield csvLine(kHeader);
  for (const row of rows) {
    const { start, end } = entrySpan(row);
    yield csvLine([
      new Date(start).toISOString(),
      new Date(end).toISOString(),
      row.actor.name,
      row.actor.kind,
      ENTRY_CATEGORIES[row.type],
      ...csvEvent(row)
    ]);
  }
}

function csvEvent(
  row: AuditRow
): [event: string, asset: string, details: string] {
  switch (row.type) {
    case "edits":
      return [
        "edits",
        assetLabel(row.asset),
        [row.count === 1 ? "1 edit" : `${row.count} edits`, row.summary]
          .filter((part) => part !== null)
          .join(": ")
      ];
    case "asset":
      return [
        `asset ${row.action}`,
        assetLabel(row.asset),
        row.previousPath ?? row.tag ?? ""
      ];
    case "tag":
      return [
        `tag ${row.action}`,
        assetLabel(row.asset),
        [row.name, row.message].filter((part) => part !== undefined).join(": ")
      ];
    case "folder":
      return [
        `folder ${row.action}`,
        "",
        [row.previousPath, row.path].filter((part) => part !== undefined).join(" -> ")
      ];
    case "account":
      return [`account ${row.activity.type}`, "", JSON.stringify(row.activity)];
    case "settings":
      return [
        `settings ${row.section}`,
        "",
        JSON.stringify({
          before: row.before,
          after: row.after
        })
      ];
    default:
      return row satisfies never;
  }
}

function assetLabel(
  asset: AuditAsset
): string {
  return asset.path ?? asset.id;
}

function csvLine(
  cells: readonly string[]
): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

function csvCell(
  value: string
): string {
  const safe = kFormulaStart.test(value) ? `'${value}` : value;

  return kNeedsQuotes.test(safe) ? `"${safe.replaceAll("\"", "\"\"")}"` : safe;
}

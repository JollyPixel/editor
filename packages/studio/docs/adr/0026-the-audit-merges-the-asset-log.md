---
status: accepted
---

# The audit merges the asset log with its own

Settings › Audit lists who changed what. `GET /api/audit` reads three sources newest first and
merges them by time:

1. `events.db`, the asset event log: content edits, created, renamed, replaced and deleted assets.
2. Its tags.
3. `.jollypixel/audit.db`, which the studio writes: settings changes with the section before and
   after, and the accounts' activity (registrations, approvals, denials, role changes, ownership
   transfers, removals, share links), each with the account that made it.

Edits by one actor on one asset less than 5 minutes apart fold into one row. The cursor holds a
position in each source, so a page continues where the last one stopped. A run of edits that
crosses a page boundary shows as two rows.

## Considered Options

- **Mirroring asset events into `audit.db` as they are appended.** The audit would keep every edit,
  but each one would be written twice and the folding would happen at write time.
- **Turning compaction off.** `events.db` would grow with every stroke, and opening the workspace
  replays more of it.

## Consequences

- Compaction drops the edits below each asset's newest checkpoint, so the history of an asset
  reaches back to its last snapshot only.
- Folder changes write no event and do not show.
- Snapshots the server takes on its own are skipped. Files changed on disk show as "Files on disk".

# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## Settings

The Settings tab has two halves. **You**, the signed-in account's
preferences, is built ([ADR-0023](./docs/adr/0023-preferences-follow-the-account.md),
[ADR-0024](./docs/adr/0024-editors-read-preferences-from-the-shell.md)).
**Project** holds the settings everyone shares, and shows only the sections
the caller's role can read.

### 1. Project settings and the audit log

- `project.json` stays the source of truth and the studio server becomes its
  only writer. `PUT /api/project/settings/<section>` validates with the
  schemas `StudioAccess` and the kind options already use, then rewrites the
  file. Comments and hand-picked key order are lost.
- Changes apply without a restart. `access` swaps the `RightsTable` and
  invalidates the network rights cache; kind options reach new assets and the
  snapshot timers. The dev watcher ignores the server's own writes and still
  restarts on hand edits.
- `studio.$settings` and `studio.$audit` count only when a role names them:
  `*` and `studio.*` do not grant them, so by default only admins see
  Project. `$share` and `$export` keep matching wildcards.
- The Access section is admin only by a fixed rule, like role changes in
  `AccountEntity`.
- `.jollypixel/audit.db` is a `TypedEventStore`. Accounts emits domain events
  (register, approve, deny, role change, owner transfer, share link created
  or revoked) and the studio records them, with every settings change and the
  section before and after it.
- Project › General shows the project name. Export stays on Home, in the
  asset browser and the right column, and is disabled without `canExport`.
- Project › Editors lists the editor packages read-only and edits the kind
  options: pixel-art and blockset `defaultSize`, blockset `tileSize`,
  voxelmap `chunkSize`, snapshot `delay` and `maxDelay`.

### 2. Access section

- Roles. The built-in `admin` and `guest` show read-only. A role's rules are
  an ordered list of pattern and right where the first match wins, reordered
  by dragging. A "check a room" field shows which rule matches a key and the
  right it gives. `$settings` and `$audit` are two checkboxes.
- Adding a role takes a name. Deleting one is refused while an account holds
  it or while it is the `defaultRole`. No rename.
- The default role and the `accessRequests` toggle.
- Members: role change and owner transfer leave the Home Users pane, which
  keeps a read-only roster.
- Requests: approve with a role, or deny.
- Share links leave the tab they share with Users on Home. Members see their
  own links, admins see all.
- A saved change re-checks rights for connected sessions, and a client that
  loses read on an open room leaves it. Find out whether network can re-run
  the check for a live session or needs a new primitive.

### 3. Audit view

- `GET /api/audit` merges `events.db` and `audit.db` by time, pages with a
  cursor and resolves actor ids to usernames, or "deleted user".
- Asset events by one actor on one asset, less than 5 minutes apart, fold
  into one row: actor, asset, change count, time span. Catalog events, tags
  and `audit.db` events get a row each; a settings change expands to its
  before and after.
- Filters: actor, asset, category (edits, structure, accounts, settings) and
  a date range. Account rows show to admins only.
- A refresh button, no subscription.

## Waiting for a trigger

- **Voxel-model shortcuts.** Undo, redo and the `k` keying shortcut are
  hardcoded, so they are missing from Settings › Keybindings. Give voxel-model
  an action list when one of them needs rebinding.

- **Camera preferences in the pixel-art preview.** The preview turntable is
  an `OrbitFlyCamera` too, but only voxel-map and voxel-model apply the
  `camera` scope. Add it if users move around the preview.

- **Per-editor launch preferences.** Each frame gets every scope's overrides,
  since a frame does not know which editor it hosts. Filter them once a scope
  holds something an editor should not see.

- **Confirm closing an unsaved tab.** Closing, evicting or reloading a marked
  tab drops its frame without asking. Changes already sent usually reach the
  server; only those held while offline or refused are lost. A confirmation
  makes `EditorTabs.close` async, like `confirmEvict`.

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K
  and `session-refused`, but no editor calls `context.shell` since the
  voxel-map Paint action was dropped. A title is the expected next command;
  add it when an editor needs the shell to show one.

- **Export and import preferences.** Preferences belong to one project's
  account. A JSON file would carry keybindings and the rest to another
  project.

- **Rename a role.** `users.role` stores the role name, so a rename rewrites
  accounts too. Until then, add a role and reassign its members.

## Long-term goals

### Browser-hosted sessions

Editor sessions served from a browser tab, with guests joining over WebRTC.
See [HOSTING.md](./HOSTING.md).

### Project policy for editors

Kind options are the only editor configuration a project sets. A project
could also give defaults for editor preferences, or force values a user
cannot override, such as baked voxel-map lighting or `uvSync: live` for
collaboration. Preference descriptors leave room for a project scope per
field.

### Audit history

Diffs for asset edit runs, opening an asset at the version a row points to,
CSV export and retention.

### Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

### In-process editors

Mount editors in the shell's document instead of iframes. The
`EditorDefinition` contract assumes one editor per document:

- `mountStandalone` owns page-wide state: `data-editor-state` on `<html>`,
  the `jollyEditor` debug global and `LastOpenedLaunchSource`.
- `EditorContext` carries no container, so editors mount into the page's own
  DOM.
- Embedded panels (voxel-map's `TextureEditor`, voxel-model's texture panel)
  take an `AssetLeases` lease, not a context.

A starting shape: a base context every mounted piece gets,
`{ container, assets, shell, logger }`, that a full editor extends with
`launch` and `session`. A panel is then a smaller definition on the same
contract. `ShellChannel` wraps a `ShellPort`, so an in-process port is
trivial.

To settle in a design pass first:

- One `EditorSession` and WebSocket for every editor, or one each.
- CSS isolation: a shadow root per editor, or stay in iframes.
- One `Runtime` per editor and its WebGL context cost.
- `Keyboard.addGuard` and the input layers assume one editor per page.
- Page-wide state moves to the shell or becomes per editor.

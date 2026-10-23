# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md).

Each step ends with `pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and `pnpm run lint` green.

## Next steps

### 1. Project policy for editors

Kind options are the only editor configuration a project sets. Preferences
belong to each account, and a scope stores only the fields that differ from
their descriptor's `default`. A project should be able to give a field its own
default, or lock a value no account can change, such as voxel-map's
`uvSync: live` for a team that paints together.

- **The section.** `project.json` gets a `preferences` section, by scope:

  ```json
  "preferences": {
    "voxel-map": {
      "defaults": { "lighting": "day", "shadows": true },
      "locked": { "uvSync": "live" }
    }
  }
  ```

  `PUT /api/project/settings/preferences` checks each value with the scope's
  `PreferenceScope.parse`, as `kinds` is checked with each package's
  `optionsSchema`, and refuses an unknown scope or field. Loading the file
  drops values for a scope or field no installed editor declares, as `prune`
  does for accounts.
- **Resolution.** A value comes from the descriptor default, then the project
  default, then the account override, then the project lock. `resolve`,
  `prune` and `update` take the project layer as their base instead of the
  descriptor alone. An override equal to the descriptor default is then kept
  when the project default differs, since it is how an account opts back out.
- **Locked fields.** `PUT /api/preferences/<scope>` and the
  `update-preferences` shell command refuse a locked field, and Settings shows
  it disabled with the project's value. The frame needs the locks too:
  voxel-map's `UvSyncStore` assigns `uvSync` from its own menu.
- **Delivery.** `jolly-launch` carries the project layer next to the
  overrides. A saved section reaches open frames like a `jolly-preferences`
  push, without a restart, the way new kind options rebuild their handlers.
- **Key bindings stay out.** `#checkChords` checks one account's chords
  against the descriptor defaults, so a project chord could take one an
  account already bound. Chord and key fields wait until that check sees
  every layer.

Saves land in `audit.db` with the section before and after once
`settingsSectionSchema` lists `preferences`. The offline studio keeps the
section it was built with, as it does for kind options.

### 2. Audit history

Settings › Audit merges `events.db`, its tags and `audit.db` at read time, and
`events.db` makes a poor history. The asset server compacts it on open and
before each snapshot, dropping every event below an asset's newest checkpoint
except tagged versions, so edit rows reach back to the last snapshot only.
Folders live in the asset source and write no event at all.

In the order it should land:

- **Record as it happens.** The studio subscribes to `events.db` appends and
  writes each edit run to `audit.db` once it closes: actor, asset, count,
  first and last time, and the event versions it spans. Created, renamed,
  replaced and deleted assets get a row each. Folder commands need a hook in
  the catalog room to report theirs. Writing one row per run, not per event,
  keeps `audit.db` small. The feed then pages `audit.db` alone, and the
  read-time folding in `EditRuns`, the three-source `AuditCursor` and the run
  split at a page boundary go away. Earlier history is not backfilled.
- **Open the version a row points to.** Editors already open a tagged version
  read-only: `EditorLaunch` carries a `tag` and the asset room serves it from
  `AssetTags.read`. A run keeps the snapshot written after it as a tag of its
  own kind, like the restore points a restore writes, and compaction already
  spares tagged versions (`retainedPartEvents`). The studio's `jolly-launch`
  carries only a `target`, so it needs a `tag`, and a tab is then keyed by
  asset and tag.
- **Diffs.** With a version kept at both ends of a run, a diff compares two
  contents. What it shows depends on the kind (changed pixels for a texture,
  changed blocks for a voxel map), so it is a kind handler hook. Kinds without
  one keep the open action only.
- **CSV export.** A page of `GET /api/audit` stops after 5,000 scanned events.
  An export streams every row the current filters match, behind the same
  `studio.$audit` right.
- **Retention.** Each kept version is a full copy of the asset. A project
  setting prunes rows and kept versions past an age, separately. Tags a user
  named are never pruned.

## Long-term goals

### Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

### In-process editors

Mount editors in the shell's document instead of iframes. That drops the
`jolly-ready`/`jolly-launch` handshake, the catalog and console ports and the
zod-checked messages, and lets editors share one back-end connection and one
copy of `editor.host` and `@jolly-pixel/ui`.

Frames buy no security today: a same-origin frame reaches `window.parent` and
the shell's storage. What they buy is containment. Removing a frame frees
everything its editor allocated, and a reload or a leaked global stays inside
its tab. In-process, every editor must dispose cleanly and nothing may touch
`location`.

The `EditorDefinition` contract assumes one editor per document:

- `StandaloneEditor` owns page-wide state: `data-editor-state` on `<html>`,
  the loading bar in `<body>`, the `jollyEditor` debug global, the console
  and Lantern, `KeyboardLayoutStore.watch(window)`, `pagehide`/`pageshow`
  and `beforeunload`. `Placement` adds `LastOpenedLaunchSource` and
  `PageHistory`, which calls `pushState` and `location.assign`.
- Share links and peer invites recover with `location.reload()`.
- `EditorContext` carries no container. The voxel-map, voxel-model and
  pixel-art shells find their elements with `document.querySelector` in their
  page's `index.html`.
- Embedded panels (voxel-map's `TextureEditor`, voxel-model's texture panel)
  take a lease opened from the session's `AssetLeases`, not a context.
- `ShellChannel` posts through a `ShellPort`, but `onAppearance`,
  `onPreferences` and `renewWhenRefused` listen to `window` `message` events
  and check `event.source`. An in-process port needs an inbound side too.

A starting shape: a base context every mounted piece gets,
`{ container, assets, shell, logger }`, that a full editor extends with
`launch` and `session`. A panel is then a smaller definition on the same
contract.

To settle in a design pass first:

- One `EditorSession` and WebSocket for every editor, or one each.
- CSS isolation: a shadow root per editor, or stay in iframes.
- One `Runtime` per editor, each with its own `WebGPURenderer`, and whether
  the four-tab cap still holds.
- Custom element names are global to a document, so every in-process editor
  runs the shell's `editor.host` and `@jolly-pixel/ui`. Prebuilt external
  editors either stay in frames or ship as modules.
- `Keyboard.addGuard` and the input layers assume one editor per page.
- Page-wide state moves to the shell or becomes per editor.

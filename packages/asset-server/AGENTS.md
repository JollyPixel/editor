# AGENTS.md

## Kinds

- A stored command is replayed in the form it was written. When a command
  changes shape, add `commands.upcast` instead of widening `protocol`.
- Command, relay and part messages share one discriminator (`action` by
  default). `subscribe-parts` and `unsubscribe-parts` are reserved, and a tag
  used twice throws when `registerAssetRooms` starts.
- Declare `commands.relay` with `live().relay`, and `parts` with
  `live().parts`. A room with only one of a pair refuses to open.
- When several kinds claim a path, the longest extension wins:
  `.voxelmap.json` before `.json`.

## Lifetime

- Close the network server before `AssetServer`: evicting a room may flush a
  snapshot. `AssetServer.close()` never closes the network server or the
  source.
- Content refs need a `ContentRefs` at attach time. Without one, as in the
  in-page offline server, every snapshot is sent inline.

## Schemas

- Keep a zod schema in the module that parses it. Split it into
  `<Module>.schema.ts` only when other modules import it as a message or
  stored format, or when `./client` needs the module's constants without
  building its schemas.

## State directory

- `.jollypixel/state.json` can be rebuilt from the event store; `events.db`
  and `objects/` cannot. Commit `assets.json` to keep IDs stable without an
  event log.
- A manifest renamed or deleted outside the backend leaves its `.parts/`
  folder behind.

## Project packages

- Any room writer can write a file anywhere the source does not ignore. Pass
  `resolver.ignoreGlobs(...)` as `AssetServer`'s `ignore`, as studio's
  `StudioProject.assetIgnores()` does: it reserves the root `package.json`,
  whose name a Node or Vite self-reference would resolve as a kind, and every
  local package (`./kinds/foo`) inside the project.

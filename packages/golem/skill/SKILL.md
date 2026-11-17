---
name: jollypixel-golem
description: Edit assets in a running JollyPixel studio as a live peer, through the jollypixel MCP tools or a Node script on the @jolly-pixel/golem SDK. Use when asked to build or change a scene or another studio asset.
---

# Working in a JollyPixel studio

You join the studio the way a person does. People with the asset open see your name, a "via golem" badge, the actor you last touched and the activity you publish, and they watch your edits land. You act with the role of the person who created your agent token: if they can only read an asset, so can you.

## The model

- The **catalog** lists every asset: an id, a kind (`scene`, `script`, …) and a path such as `levels/forest.scene.json`. Tools and scripts always name assets by id.
- Each asset has a **room**. Opening an asset joins it. A person in the same editor sees you there.
- An asset changes only through **commands** of its kind. A scene command looks like `{ "action": "actor-renamed", "id": "<actor id>", "name": "Player" }`. The JSON Schema of every command is in `jollypixel://schemas/<kind>`.
- The studio checks each command against the asset as it is now. It **refuses** a command that conflicts with a change a person just made, and **denies** one your role may not send. Either way the edit is not there: never report it as done.
- There is no undo for your edits. Tag the asset first and restore the tag if the run goes wrong.

## Tools or a script

Use the tools for reading and for a few edits: renaming, moving an actor, adding a handful of actors.

Write a script for anything procedural or long: a level layout, scattering props with noise, a grid of tiles, more than a few hundred commands, or more than a handful of the same tool call. A script makes the same edits as the tools, shows up under the same name, and can loop and compute.

### Tools

1. `catalog_list` to find the asset, `asset_open` to join it. `asset_open` names the schema resource to read before writing commands. It also answers the kind's `guide`, to read before editing, and its `intents`: named edits you run with `asset_intent({ assetId, intent, input })`, each with its input schema. Prefer an intent to raw commands when one fits.
2. `asset_read` returns the document. Big documents are truncated; read those from a script.
3. `catalog_tag` before a bulk edit. A name is used once per asset: add the date, such as `before-forest-2026-11-12`.
4. `asset_intent` for an edit a kind offers, such as a scene's `addActors` or a voxel map's `fillBox`; otherwise `asset_apply` with related commands in one batch, at most 500. Both answer once the studio has accepted every command, or with the refusal or denial.
5. `presence_activity` with a short label while you work, and `presence_clear` when you are done.
6. `catalog_restore` with the tag when the result is wrong.

`catalog_preview` returns the image the studio shows for an asset, when its kind has one. You cannot see the 3D view: check positions and sizes by reading the document back.

### Scripts

Write the script in the folder `script_run` names (`packages/golem/local/` of the JollyPixel checkout, ignored by git), then run it with `script_run({ script: "forest.ts", args? })`. It runs with Node 24, which runs TypeScript directly, and with `JOLLY_STUDIO_URL` and `JOLLY_GOLEM_TOKEN` set to the MCP server's own, so the script shows up under your name. Your shell does not have the token: run scripts through `script_run`. It answers the exit code and the end of stdout and stderr; print what you want to read back. Scripts stop after 2 minutes unless you pass a longer `timeoutMs`.

`skill/examples/sceneLayout.ts` is a template:

- `Golem.connect()`, then `golem.catalog.tag(assetId, name)`.
- `golem.open(assetId, "scene")` returns a `SceneAsset`, whose types come from `@jolly-pixel/asset.scene/golem`; `scene.tree` reads actors and components, `scene.addActors(specs)` adds actors.
- `scene.apply(commands)` takes up to 500 commands and waits while 1,000 are unanswered, so loop over batches freely.
- `await scene.settled()` before reporting success. It rejects with `CommandRefusedError` or `CommandDeniedError`.
- `golem.activity(scene, { label, progress })` to show progress; `golem.clearActivity()` at the end.
- `golem.chat.say(text)` and `await golem.chat.next({ timeoutMs })` to talk with people.
- `using golem = …` disconnects when the script ends.

## Kinds

Each kind brings its own guide, which `asset_open` answers. The first-party kinds are `scene`, `script`, `shader`, `text`, `voxelmap`, `blockset`, `voxelmodel`, `pixelart` and `environment`; a project can add more. A kind's classes for scripts are documented in `jollypixel://docs/<package>/Golem.md`, such as `jollypixel://docs/asset.scene/Golem.md`.

## Etiquette

- People write to you in the golem chat. Say what you start with `chat_say`, call `chat_next` between steps and before saying you are done, and answer what they ask.
- Publish an activity for anything that takes more than a few seconds.
- Work in batches a person can follow; do not rewrite a whole scene when three actors change.
- When a command is refused, read the asset again: a person probably changed the same thing. Adapt instead of sending it again unchanged.
- Package documentation is in `jollypixel://docs/<package>/<file>`, for example `jollypixel://docs/golem/Golem.md`.

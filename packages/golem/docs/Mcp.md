# MCP server

`jolly-golem mcp` runs a stdio MCP server over one [Golem](./Golem.md), for agents such as Claude Code, Codex or Cursor. Its tools cover reads and small edits; procedural work belongs in a script on the SDK.

## Registering it

Build the package (`pnpm --filter @jolly-pixel/golem run build`), create a token on the studio's Agents page, then register the server. For Claude Code, the Agents page prints the line:

```sh
claude mcp add jollypixel --env JOLLY_GOLEM_TOKEN=<token> -- node <checkout>/packages/golem/dist/bin/jolly-golem.js mcp --url <studio url>
```

`--url` defaults to `JOLLY_STUDIO_URL` and `--token` to `JOLLY_GOLEM_TOKEN`. The server exits at once without a URL or a token. It connects on the first tool call, so it starts even when the studio is down: tools then answer with `StudioUnreachableError` until the studio is up.

`jolly-golem status` connects once, prints the studio status as JSON and exits.

## Tools

Tools answer with compact JSON. A result over 32,000 characters becomes `{ truncated: true, length, head }`, `head` holding its first characters. A failure, such as a denied or refused command, is an error result carrying the SDK's error message.

- `studio_status`: the studio URL, the golem's role, the connected peers, the open assets with their unanswered commands and peers, and `unreadChat`, the number of chat messages `chat_next` would return.
- `catalog_list({ folder?, kind? })`: assets as `{ assetId, kind, path }`, sorted by path.
- `catalog_create({ path, kind? })`: creates an empty asset and returns its `assetId`.
- `catalog_rename({ assetId, to })`
- `catalog_preview({ assetId })`: the preview as image content, or a text result when the kind has none.
- `catalog_tag({ assetId, name, message? })` and `catalog_restore({ assetId, tag })`.
- `asset_open({ assetId })`: joins the asset's room and returns its kind and schema resource.
- `asset_close({ assetId })`
- `asset_read({ assetId })`: the document as JSON.
- `asset_apply({ assetId, commands })`: applies up to 500 commands and answers once the studio accepted them all.
- `scene_add_actors({ assetId, parentId?, actors })`: adds actors, given as `SceneAsset.addActors` specs ([GolemAsset](./GolemAsset.md)), and answers `{ assetId, actors }` once the studio accepted them.
- `scene_transform_actors({ assetId, changes })`, `scene_move_actors({ assetId, actors, parent, before? })` and `scene_remove_actors({ assetId, actors })`: the `SceneAsset` methods of the same name, answering `{ assetId, transformed }`, `{ assetId, moved }` or `{ assetId, removed }`. Actors are names or ids.
- `scene_add_components({ assetId, actor, components })`: adds components, asset slots named by id or catalog path, and answers `{ assetId, components }` with their `{ id, type }`.
- `text_read({ assetId, from?, to? })`: a script, shader or text asset as `{ assetId, kind, from, to, lineCount, text }`, whole or the lines `from` to `to` counted from 1.
- `text_replace({ assetId, search, replace, all? })`: replaces `search`, which must appear once unless `all` is true, and answers `{ assetId, replaced }` once the studio accepted it.
- `text_write({ assetId, text })`: replaces the whole text, sending only what differs, and answers `{ assetId, lineCount }`.
- `voxelmap_summary({ assetId })`: a voxel map's layers, blocksets and blocks, as `VoxelMapAsset.summary()`.
- `voxelmap_query({ assetId, min, max, layer? })` and `voxelmap_heightmap({ assetId, min, max, layer? })`: the occupied cells of a box, and its heights seen from above.
- `voxelmap_add_layer({ assetId, name, above? })`: adds an empty layer and answers `{ assetId, layer: { id, name } }` once the studio accepted it.
- `voxelmap_fill_box({ assetId, layer, min, max, block })` and `voxelmap_clear_box({ assetId, layer, min, max })`: fill or empty a box on one layer, answering `{ assetId, written }` or `{ assetId, cleared }` once the studio accepted it.
- `voxelmodel_add_materials({ assetId, materials })` and `voxelmodel_add_blocks({ assetId, parent?, blocks })`: `VoxelModelAsset.addMaterials` and `addBlocks`, answering `{ assetId, materials }` with their `{ id, name }`, or `{ assetId, blocks }` with their `{ id, name, uv, shared }`.
- `pixelart_read_pixels({ assetId, x, y, width, height })`: up to 4,096 pixels as rows of `"#rrggbbaa"`.
- `pixelart_paint({ assetId, pixels })`, `pixelart_fill_rect({ assetId, x, y, width, height, color })` and `pixelart_replace_palette({ assetId, colors })`: the `PixelSurface` methods, answering `{ assetId, painted }` or `{ assetId, colors }`.
- The `pixelart_*` tools take a `pixelart` or a `blockset` id; another kind fails with `KindMismatchError`.
- `presence_activity({ assetId, label, progress? })`: publishes the golem's activity on the asset.
- `presence_clear()`: clears it.
- `chat_say({ text, assetId? })`: writes in the golem chat and returns the message's `id` and `at`.
- `chat_next({ timeoutMs? })`: what people wrote since the last call, as `{ username, text, assetId?, at }`. Waits up to `timeoutMs` (default 30,000, at most 120,000) when nothing is unread, then returns `[]`.
- `script_run({ script, args?, timeoutMs? })`: runs `node <script>` from the package's `local/` folder, with `JOLLY_STUDIO_URL` and `JOLLY_GOLEM_TOKEN` set to the server's, so a script connects under the golem's name without the token reaching the agent. Answers `{ exitCode, timedOut, stdout, stderr }`, each output cut to its last 8,000 characters. A path outside `local/` fails. Stops the script after `timeoutMs` (default 120,000, at most 600,000).

`asset_read`, `asset_apply`, the `scene_*`, `text_*`, `voxelmap_*`, `voxelmodel_*` and `pixelart_*` tools and `presence_activity` open the asset when it is not open yet.

## Resources

- `jollypixel://guide`: the skill, `skill/SKILL.md`.
- `jollypixel://schemas/<kind>`: the JSON Schema of a kind's commands.
- `jollypixel://docs/<package>/<file>`: a package's `docs/` page from the checkout, named without the `@jolly-pixel/` scope, such as `jollypixel://docs/golem/Golem.md`.

## `GolemMcpServer`

`@jolly-pixel/golem/mcp` exports the server for other transports:

```ts
import { GolemMcpServer } from "@jolly-pixel/golem/mcp";

const server = new GolemMcpServer({ url, token });
await server.connect(transport);
// …
await server.close();
```

`new GolemMcpServer(options?)` takes the [`Golem.connect` options](./Golem.md#options) and throws `TypeError` when they and the environment give no URL or no token. `connect(transport)` serves MCP on any MCP SDK transport, and `close()` ends it and disconnects the golem. `mcp` is the underlying `McpServer`.

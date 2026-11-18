# MCP server

`jolly-golem mcp` runs a stdio MCP server over one [Golem](./Golem.md), for agents such as Claude Code, Codex or Cursor. Its tools cover reads and small edits; procedural work belongs in a script on the SDK.

## Registering it

Build the package (`pnpm --filter @jolly-pixel/golem run build`), create a token on the studio's Agents page, then register the server. For Claude Code, the Agents page prints the line:

```sh
claude mcp add jollypixel --env JOLLY_GOLEM_TOKEN=<token> -- node <checkout>/packages/golem/dist/bin/jolly-golem.js mcp --url <studio url>
```

`--url` defaults to `JOLLY_STUDIO_URL` and `--token` to `JOLLY_GOLEM_TOKEN`. `--project` is the `projectRoot` the project's kind packages resolve from, `JOLLY_PROJECT` or the current folder by default: pass the studio's project folder when it has kind packages of its own. The server exits at once without a URL or a token. It connects on the first tool call, so it starts even when the studio is down: tools then answer with `StudioUnreachableError` until the studio is up.

`jolly-golem mcp --bridged` leaves out `chat_say` and `chat_next`: the [bridge](./Bridge.md) starts the server that way, since it delivers the owner's messages as prompts and posts the agent's replies itself.

`jolly-golem status` connects once, prints the studio status as JSON and exits.

## Tools

Tools answer with compact JSON. A result over 32,000 characters becomes `{ truncated: true, length, head }`, `head` holding its first characters. A failure, such as a denied or refused command, is an error result carrying the SDK's error message.

- `studio_status`: the studio URL, the golem's role, the connected peers, the open assets with their unanswered commands and peers, and `unreadChat`, the number of chat messages `chat_next` would return.
- `catalog_list({ folder?, kind? })`: assets as `{ assetId, kind, path }`, sorted by path.
- `catalog_create({ path, kind? })`: creates an empty asset and returns its `assetId`.
- `catalog_rename({ assetId, to })`
- `catalog_preview({ assetId })`: the preview as image content, or a text result when the kind has none.
- `catalog_tag({ assetId, name, message? })` and `catalog_restore({ assetId, tag })`.
- `asset_open({ assetId })`: joins the asset's room and returns its kind and schema resource. When the kind has them, it adds `guide`, Markdown on working with the kind, and `intents`, each `{ name, description, input }` with `input` a JSON Schema.
- `asset_intent({ assetId, intent, input? })`: runs one of the kind's intents and answers `{ assetId, intent, result }` once the studio accepted its commands. `result` is what the asset method of the same name returns, and is left out when it returns nothing. An unknown intent fails with `UnknownIntentError`, an input outside the intent's schema with `IntentInputError`. Each asset package documents its kinds' intents in its `docs/Golem.md`, such as `addActors` for a scene, `fillBox` for a voxel map or `change` for an environment.
- `asset_close({ assetId })`
- `asset_read({ assetId })`: the document as JSON.
- `asset_apply({ assetId, commands })`: applies up to 500 commands and answers once the studio accepted them all.
- `presence_activity({ assetId, label, progress? })`: publishes the golem's activity on the asset.
- `presence_clear()`: clears it.
- `chat_say({ text, assetId? })`: writes in the golem chat and returns the message's `id` and `at`.
- `chat_next({ timeoutMs? })`: what people wrote since the last call, as `{ username, text, assetId?, at }`. Waits up to `timeoutMs` (default 30,000, at most 120,000) when nothing is unread, then returns `[]`.
- `script_run({ script, args?, timeoutMs? })`: runs `node <script>` from the package's `local/` folder, with `JOLLY_STUDIO_URL`, `JOLLY_GOLEM_TOKEN` and `JOLLY_PROJECT` set to the server's, so a script connects under the golem's name without the token reaching the agent. Answers `{ exitCode, timedOut, stdout, stderr }`, each output cut to its last 8,000 characters. A path outside `local/` fails. Stops the script after `timeoutMs` (default 120,000, at most 600,000).

`asset_read`, `asset_apply`, `asset_intent` and `presence_activity` open the asset when it is not open yet.

## Resources

- `jollypixel://guide`: the skill, `skill/SKILL.md`.
- `jollypixel://schemas/<kind>`: the JSON Schema of a kind's commands. Listing and reading them connect to the studio first.
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

`new GolemMcpServer(options?)` takes the [`Golem.connect` options](./Golem.md#options), plus `bridged` (default `false`) to leave the chat tools out, and throws `TypeError` when they and the environment give no URL or no token. `connect(transport)` serves MCP on any MCP SDK transport, and `close()` ends it and disconnects the golem. `mcp` is the underlying `McpServer`.

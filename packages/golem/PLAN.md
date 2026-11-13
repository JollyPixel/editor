# @jolly-pixel/golem — PLAN

What is left to build, in order. The design is in `SPEC.md`. Each step ends
with the touched packages' tests, `pnpm run typecheck` and `pnpm run lint`
green, and `pnpm run build` for every changed workspace before its consumers
are tested.

Built, uncommitted: agent tokens, the SDK core, the MCP server and skill,
chat, and the `scene`, `script`, `shader`, `text`, `voxelmap`, `blockset`,
`voxelmodel` and `pixelart` kinds. Claude Code trial run on 2026-11-12;
`local/trial*.ts` set it up again (owner, tokens, seeded assets, a person in
the chat). Trial follow-ups and `llms.txt` built too: scene component checks
from the editors' `sceneComponents` manifests, voxel model nets placed in
free texture space (growing the texture), blockset texture painting through
`PixelSurface`, and `llms.txt` / `llms-full.txt` from `docs:build`.

## 3. Bridge

ACP checked on 2026-11-12. `session/new` takes `cwd` and `mcpServers`; every
agent supports stdio servers (`name`, `command`, `args`, `env`).
`session/request_permission` offers `allow_once`, `allow_always`,
`reject_once`, `reject_always` and is answered `selected` or `cancelled`.
`session/cancel` is a notification, and the client answers pending
permission requests `cancelled`. Adapters: `@agentclientprotocol/claude-agent-acp`
and `@agentclientprotocol/codex-acp`. Client library:
`@agentclientprotocol/sdk` (`ClientSideConnection`, `ndJsonStream`). Pin
versions when installing.

The `Origin` check is already done: `HandshakePolicy` in
`@jolly-pixel/network` refuses an upgrade from another browser origin unless
`allowedOrigins` lists it, and the studio passes none.

### 3.1 `jolly-golem bridge`

A process on the owner's machine joins `agent-chat` with their token, runs
the agent over ACP and hands it the golem MCP server. Only the owner's
messages become prompts, and only the owner answers permission requests.

- [ ] Approve `@agentclientprotocol/sdk` as a dependency.
- [ ] Owner: the agent profile gains `owner`, the owning account's `peerId`
      (`toAgentIdentity` in `@jolly-pixel/accounts`, `PeerProfileMetadata` in
      `@jolly-pixel/network`, changesets). The bridge compares `said.peerId`
      to it; the pane uses it to show the buttons and "Golem (Bob)".
- [ ] `src/bridge/GolemBridge.ts`: spawn the agent command, `initialize`,
      `session/new` with `jolly-golem mcp --bridged` as a stdio server
      (`process.execPath`, the url, the token in `env`).
- [ ] Turns: an owner `said` becomes `session/prompt`, queued while a turn
      runs. Message chunks are buffered and sent as one `say` when the turn
      ends or a tool call starts; tool call titles go to `activity`.
- [ ] Permissions: `agent-chat` gains `permission-requested` (`id`, `title`,
      options) and `permission-answered` (`id`, `optionId`); the bridge
      ignores answers from anyone but the owner. Calls to the `jollypixel`
      MCP server are allowed without asking. To check: how each adapter names
      an MCP tool call in `toolCall`. Without a reliable name, every request
      asks.
- [ ] Cancel: a Stop button and `/golem stop` send `cancel` (owner only); the
      bridge sends `session/cancel` and answers pending requests `cancelled`.
- [ ] `jolly-golem mcp --bridged` drops `chat_next`: the bridge delivers the
      person's messages.
- [ ] CLI: `jolly-golem bridge --url <studio> --agent claude|codex|<command>`;
      `claude` and `codex` run the two adapters with `npx`. The Agents page
      prints the bridge line next to the MCP one.
- [ ] Studio pane: permission buttons and Stop for the owner.
- [ ] Tests: `GolemBridge` against a fake agent (`AgentSideConnection` over
      in-memory streams) and the test studio: prompt to `said`, a
      non-owner's message ignored, a permission round trip, cancel answering
      a pending request. Server: the new `agent-chat` messages.
- [ ] Docs: `docs/Bridge.md`, the skill, SPEC "Phase 2".

### 3.2 `Origin` on upgrade

- [ ] A `@jolly-pixel/server` backend test that an upgrade with a foreign
      `Origin` is refused and one without `Origin` (golem) is accepted.

## 4. Publish

- [ ] Publish `@jolly-pixel/golem` when people outside the repository need it:
      bundle or publish the `asset.*` client entries, setup line becomes
      `npx` (it drops the `<checkout>` placeholder).

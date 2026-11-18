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
The `environment` kind came on 2026-11-17. The same day every kind moved
to its asset package's `golem` entry over `@jolly-pixel/golem.kit`, the golem
importing them from the manifest's kind packages, and the per-kind MCP tools
became intents run through `asset_intent`.

The bridge was built on 2026-11-17 (`docs/Bridge.md`, SPEC "Phase 2"), with
the server test for a foreign `Origin` on upgrade. It is tested against a
fake ACP agent, in process and over stdio, not against the real adapters yet.

## 3. Bridge trial

- [ ] Run `jolly-golem bridge --agent claude` against the dev studio with the
      `local/trial*.ts` setup: a prompt from the pane, a golem tool call
      allowed without asking, a shell permission answered from the pane, Stop
      during a turn.
- [ ] The same with `--agent codex`, which checks the `is_mcp_tool_approval`
      path.

## 4. Publish

- [ ] Publish `@jolly-pixel/golem` when people outside the repository need it:
      bundle or publish the `asset.*` client entries, setup line becomes
      `npx` (it drops the `<checkout>` placeholder).

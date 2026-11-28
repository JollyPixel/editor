# AGENTS.md

## MCP server

- Stdout carries the MCP protocol. Log to stderr only: `Golem.connect` gives
  the network client a `consoleLogger` over `process.stderr`.
- Declare tool schemas with classic `zod`. The MCP SDK reads
  `~standard.jsonSchema`, which `zod/mini` lacks. Kind command schemas and
  intent inputs stay `zod/mini` and go out through `z.toJSONSchema`.
- Keep the SDK's plain `StdioServerTransport`. Claude Code accepts
  `notifications/claude/channel` only on its 2025 handshake.

## Bridge

- Spawn agents with `shell: true`, or `npx` fails on Windows.

## Kits and cycles

- `@jolly-pixel/golem.kit` must not depend on `@jolly-pixel/server`: the server
  depends on `asset.voxel-map`, whose `golem` entry depends on the kit, which
  would close a project-reference cycle.

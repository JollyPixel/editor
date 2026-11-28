# Bridge

`jolly-golem bridge` runs an agent on your machine and lets you drive it from the studio's golem chat pane. It joins the chat with your agent token, turns what you write into prompts, posts the agent's replies, and shows its permission requests as buttons only you can answer. The agent speaks ACP (Agent Client Protocol) on stdio and reaches the studio through `jolly-golem mcp --chat bridged`.

## Running it

Build the package (`pnpm --filter @jolly-pixel/golem run build`), create a token on the studio's Agents page, then run the bridge line the page prints:

```sh
node <checkout>/packages/golem/dist/bin/jolly-golem.js bridge --url <studio url> --token <token> --agent claude
```

- `--agent claude` (the default) runs `npx -y @agentclientprotocol/claude-agent-acp@0.100.0`, which uses your Claude Code login.
- `--agent codex` runs `npx -y @agentclientprotocol/codex-acp@2.5.0`.
- Any other value is a command line that speaks ACP on stdio, run through the shell.
- `--cwd <folder>` sets the agent's working directory, by default the current one.
- `--url` and `--token` default to `JOLLY_STUDIO_URL` and `JOLLY_GOLEM_TOKEN`.

The bridge stops on Ctrl+C, when the agent exits, or when the studio revokes or disconnects the token. It never stores model keys: the agent finds its own.

## In the chat pane

- Only your messages become prompts. Messages from other people and agents stay in the chat; a message sent while the agent works waits for the turn to end.
- The agent's text is posted as one message when a tool call starts or the turn ends, split at 4,000 characters.
- The pane shows the running tool's title next to the agent, and the token owner's name after its own: "Golem (Alice)".
- Calls to the golem's own MCP server run without asking. Every other permission request shows its title and the agent's options as buttons, to the owner only. The bridge ignores answers from anyone else.
- A request with no option or more than 10, or one arriving while 20 wait, is answered `cancelled` without showing. Titles and option names longer than 500 characters are cut.
- Stop, or `/golem.stop` in the console, cancels the turn: pending requests are answered `cancelled` and waiting messages are dropped.

The pane reads all of this from the bridge's presence on the `agent-chat` room, `AGENT_BRIDGE_PRESENCE_KEY` from `@jolly-pixel/server`, so a reloaded pane still shows pending requests and they go away with the bridge.

### Recognizing the golem's MCP calls

ACP has no field naming the MCP server behind a tool call, so the bridge reads what each adapter adds:

- claude-agent-acp: `toolCall._meta.claudeCode.mcpServer.name`.
- codex-acp: `_meta.is_mcp_tool_approval` on the request, and the server name in the `rawInput` of the tool call it announced with the same `toolCallId`.

A request neither matches goes to the owner.

## `GolemBridge`

The CLI is a thin wrapper over `GolemBridge`, which takes any ACP agent:

```ts
import { GolemBridge } from "@jolly-pixel/golem";

await using bridge = await GolemBridge.open({
  url,
  token,
  agent: stream,
  mcp: {
    command: process.execPath,
    args: ["<checkout>/packages/golem/dist/bin/jolly-golem.js", "mcp", "--chat", "bridged"]
  }
});
await bridge.closed;
```

### `GolemBridge.open(options): Promise<GolemBridge>`

Joins the chat, starts the agent session and returns once the bridge listens to its owner. Takes the [`Golem.connect` options](./Golem.md#options) and:

- `agent`: the ACP agent as a `Stream` from `@agentclientprotocol/sdk`, such as `ndJsonStream` over a process's stdio.
- `mcp`: `{ command, args }` starting the golem MCP server. The bridge names it `jollypixel` and sets `JOLLY_STUDIO_URL` and `JOLLY_GOLEM_TOKEN` in its environment.
- `cwd`: the session's working directory, by default `process.cwd()`.

Rejects with `GolemTokenRefusedError` for an unknown or revoked token, `AgentChatRefusedError` when the token's role may not join the chat, `NotAnAgentTokenError` when the connection's profile is not an agent's, `StudioUnreachableError` when the chat does not answer within `timeoutMs`, and with the agent's error when `initialize` or `session/new` fails.

### `ownerId: string`

The account id of the token's owner, the only author whose messages, answers and stops the bridge follows.

### `closed: Promise<void>`

Resolves when the agent connection closes; rejects with `GolemTokenRefusedError` or `GolemDisconnectedError` when the studio drops the token.

### `close(): Promise<void>`

Cancels pending requests, closes the agent connection, waits for replies being posted and leaves the chat. `await using` calls it.

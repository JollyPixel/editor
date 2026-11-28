# Golem architecture

A golem is a Node peer of the studio's `/ws-sync` socket. It acts with its token owner's role, through the same rooms and commands as an editor. Terms are defined in the [glossary](./GLOSSARY.md).

## Three ways in, one peer

```mermaid
flowchart TB
  subgraph Owner["Owner's machine"]
    Bridge["jolly-golem bridge"] -->|"ACP"| Agent["AI agent"]
    Agent -->|"tools"| Mcp["jolly-golem mcp"]
    Script["SDK script"]
  end
  Mcp --> Golem["Golem"]
  Script --> Golem
  Golem --> Studio["studio: asset-catalog, agent-chat, asset rooms"]
  Bridge -->|"agent-chat only"| Studio
```

- The golem reuses the browser's network client, catalog client and each kind's synced document.
- Code: `src/peer/`, `src/chat/`.

## Assets stay open while someone holds them

```mermaid
flowchart TB
  Caller["golem.open(id)"] --> Open["OpenAssets"]
  Map["voxel map<br/>studio.open(blockset)"] --> Open
  Open --> Asset["GolemAsset<br/>joins room kind:assetId"]
```

- Opening an asset twice returns the same one. It leaves its room when its last holder closes it.

## A batch and its answers

```mermaid
flowchart TB
  Apply["apply(commands)"] --> Check["schema, rights and locks"]
  Check --> Local["applied to the local document<br/>the sync client sends it"]
  Local --> Answer["studio answers"]
  Answer -->|"confirmed"| Settled["settled() resolves"]
  Answer -->|"refused"| Refused["rolled back, CommandRefusedError"]
  Answer -->|"denied or token revoked"| Failed["every unanswered command fails"]
```

- The golem never sends on a room itself: it edits the document, as an editor does.
- Code: `GolemAsset` and `SentCommands` in `@jolly-pixel/golem.kit`.

## Kinds come from asset packages

```mermaid
flowchart TB
  Manifest["project-manifest.json<br/>kindPackages"] --> Kinds["GolemKinds"]
  Entry["each asset package's golem entry<br/>GOLEM_KINDS"] --> Kinds
  Kinds --> Open["Golem.open"]
  Kinds --> Tools["asset_open, asset_intent"]
```

- The golem knows no kind. A package builds each kind with `golemKind(editableKind, Asset, { intents, guide })` from `@jolly-pixel/golem.kit`.
- Code: `src/kinds/`; each kind in its asset package's `src/golem/`.

## MCP tools stay kind-neutral

```mermaid
flowchart TB
  Agent["AI agent"] --> Tools["catalog, asset, presence, chat tools"]
  Agent --> Run["script_run"]
  Tools --> Session["GolemSession: one Golem"]
  Run -->|"node with the token"| Child["script under local/"]
```

- A new kind adds no tool: `asset_open` lists its intents and guide, and `asset_intent` runs one.
- The token stays in the server's process, so the agent scripts as the golem without holding it.
- Code: `src/mcp/`, `src/bin/jolly-golem.ts`.

## The bridge turns the chat into prompts

```mermaid
flowchart TB
  Owner["owner's message"] --> Bridge["GolemBridge"]
  Bridge -->|"session/prompt"| Agent["ACP agent"]
  Agent -->|"permission request"| Bridge
  Bridge -->|"golem tool"| Allowed["allowed"]
  Bridge -->|"other tool"| Pane["owner answers in the pane"]
```

- A second peer on the token, next to the MCP server's golem. It runs one turn at a time.
- Its state lives in presence, so the server keeps nothing.
- Code: `src/bridge/`, `src/bin/runBridge.ts`.

API: [Golem](./docs/Golem.md), [GolemAsset](./docs/GolemAsset.md), [ChatChannel](./docs/ChatChannel.md), [MCP server](./docs/Mcp.md), [Bridge](./docs/Bridge.md).

# Golem glossary

A golem is a local AI agent connected to a studio as a peer. It has no rights of its own: it acts with its token owner's role, through the same rooms and commands as an editor.

## Identity

### Golem

The package's name for an agent connected through this SDK. The protocol keeps the generic word **agent** (agent token, subject `agent:<tokenId>`), so another integration can reuse it without being a golem.

*In code:* `Golem`, one per connection.

### Agent token

The credential a golem connects with, created on the studio's Agents page. It carries its owner's current role and gives the golem its peer name, color and "via golem" badge. `@jolly-pixel/accounts` owns it.

*In code:* `GolemConnectOptions.token`, `JOLLY_GOLEM_TOKEN`.

## Entry points

### MCP server

The stdio server an agent registers to reach the studio through tools. It holds one golem, connected on the first tool call.

*In code:* `GolemMcpServer`, `jolly-golem mcp`.

### Skill

The guide that teaches an agent the studio, the tools and scripting against the SDK. The MCP server serves it as `jollypixel://guide`.

*In code:* `skill/SKILL.md`.

## Commands

### Unanswered command

A command the golem applied locally and sent, which the studio has neither confirmed nor refused yet. `settled()` waits for none to be left. Too many of them make `apply` wait.

*In code:* `GolemAsset.unanswered`, `MAX_UNANSWERED_COMMANDS`.

### Refused and denied

The studio **refuses** a command that conflicts with the asset as it is now, usually after a peer changed the same thing. It **denies** a command the golem's role may not send. A refusal rolls the command back locally; a denial is checked before sending, so it seldom reaches the studio.

*In code:* `CommandRefusedError`, `CommandDeniedError`.

## Presence

### Lock

A presence value saying a peer is editing a part of an asset, such as a block it moves in the voxel-model editor or a material field it changes. The studio does not enforce it: the golem reads the peers' locks before a batch and fails instead of writing over a person.

*In code:* `LockedByPeerError`, `assertModelUnlocked`, `PEER_FIELD_LOCK_KEY` from `@jolly-pixel/network`, `holdsModelLock` and `materialFieldLockPath` from `@jolly-pixel/asset.voxel-model`.

### Focus

The part of the asset the golem is editing, published the way the kind's editor shows a person's: the selected actor in a scene, the caret in a text, the brush in a voxel map, the marked block in a voxel model, the cursor in a pixel-art texture. Each batch moves it.

*In code:* `SCENE_SELECTION_PRESENCE_KEY` from `@jolly-pixel/asset.scene`, `SCRIPT_CARET_PRESENCE_KEY` from `@jolly-pixel/asset.script`, `VOXEL_BRUSH_PRESENCE_KEY` from `@jolly-pixel/asset.voxel-map`, `VOXEL_MODEL_PRESENCE_KEYS.block` from `@jolly-pixel/asset.voxel-model`, `PIXEL_CURSOR_PRESENCE_KEY` from `@jolly-pixel/asset.pixel-art`.

### Activity

A short label, with an optional progress, saying what the golem is doing. Scripts and tools publish it for longer work.

*In code:* `golem.activity()`, `golem.clearActivity()`, `PEER_ACTIVITY_KEY` from `@jolly-pixel/network`.

### Activity mirror

The golem's activity, with the asset id, published again on the golem chat so its pane lists every agent's work across assets.

*In code:* `PEER_ACTIVITY_KEY` from `@jolly-pixel/network`, `parseAgentChatActivity` from `@jolly-pixel/server`, `ActivityMirror`.

## Chat

### Golem chat

The studio-wide room where people and agents talk, shown in the studio's chat pane (`/golem`). The golem waits for people's messages with `next`.

*In code:* `golem.chat` (`ChatChannel`), the `agent-chat` room.

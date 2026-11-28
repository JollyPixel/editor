Connects a local AI agent to a running studio as a peer

## 💃 Getting Started

This workspace-private package is never published and runs from a checkout.
It needs Node 24. Build it first:

```bash
$ pnpm --filter @jolly-pixel/golem build
```

A golem signs in with an agent token, created on the studio's
Settings › You › Agents page.

## 💡 About

A golem joins a running studio the way a person does. It opens assets, appears
in the peer lists under its token's name with a "via golem" badge, and sends the
same commands an editor sends, so people in the editor watch its edits land
live. An agent reaches the studio in one of three ways:

- the `Golem` SDK, from a Node script;
- `jolly-golem mcp`, an MCP server for agents such as Claude Code;
- `jolly-golem bridge`, which runs an agent on your machine and lets its owner drive it from the studio's golem chat pane.

`skill/SKILL.md` teaches the agent the studio and how to script it; the MCP
server serves it as `jollypixel://guide`.

## 👀 Usage example

```ts
import { Golem } from "@jolly-pixel/golem";

using golem = await Golem.connect({
  url: "http://localhost:5173",
  token: process.env.JOLLY_GOLEM_TOKEN
});

const scene = await golem.open(assetId, "scene");
const [first] = scene.tree.actors();

await golem.catalog.tag(scene.id, "before-rename");
await scene.apply([
  { action: "actor-renamed", id: first.id, name: "Player" }
]);
await scene.settled();
```

Register the MCP server with Claude Code:

```sh
claude mcp add jollypixel --env JOLLY_GOLEM_TOKEN=<token> -- node <checkout>/packages/golem/dist/bin/jolly-golem.js mcp --url http://localhost:5173
```

## 📚 API

### SDK

- [Golem](./docs/Golem.md): connecting, the catalog and tags, opening assets, activity.
- [GolemAsset](./docs/GolemAsset.md): sending commands and waiting for the studio's answer.
- [ChatChannel](./docs/ChatChannel.md): the golem chat.

### Agents

- [MCP server](./docs/Mcp.md): registering it, its tools and resources.
- [Bridge](./docs/Bridge.md): driving a local agent from the golem chat pane.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit together and [GLOSSARY.md](./GLOSSARY.md) for the terms used by the package.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/golem test
$ pnpm run lint
```

[ROADMAP.md](./ROADMAP.md) lists what is left to do.

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md

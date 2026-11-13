# Golem

`@jolly-pixel/golem` lets a local AI agent join a running studio the way a person does. A golem opens assets, appears in the peer lists under its token's name with a "via golem" badge, and sends the same commands an editor sends. People in the editor watch its edits land live.

The package is private and runs from a checkout. It needs Node 24 and an agent token from the studio's Settings › You › Agents page.

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

An agent such as Claude Code reaches the studio through the MCP server instead:

```sh
claude mcp add jollypixel --env JOLLY_GOLEM_TOKEN=<token> -- node <checkout>/packages/golem/dist/bin/jolly-golem.js mcp --url http://localhost:5173
```

`skill/SKILL.md` teaches the agent the studio and how to script it; the MCP server serves it as `jollypixel://guide`.

- [Golem](./docs/Golem.md): connecting, the catalog and tags, opening assets, activity.
- [ChatChannel](./docs/ChatChannel.md): the golem chat.
- [GolemAsset](./docs/GolemAsset.md): sending commands and waiting for the studio's answer.
- [MCP server](./docs/Mcp.md): registering it, its tools and resources.
- [Glossary](./GLOSSARY.md) and [architecture](./ARCHITECTURE.md).

`SPEC.md` holds the design and `PLAN.md` the build order.

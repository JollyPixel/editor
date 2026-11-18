## 📌 About

Private workspace holding the contract between the golem and an asset kind. An asset package implements it so golems can open its kind, without depending on `@jolly-pixel/golem`.

- `GolemAsset` is the base class of one open asset: it checks a batch against the kind's command schema and the peer's rights, applies it through the kind's `localEdits`, and tracks the studio's answers. A subclass adds `read()`, `focus(commands)` and methods that build commands and call `apply`. It reads its document through `synced` and the studio through `studio`, and needs no constructor: build helpers in field initializers.
- `golemKind(editableKind, Asset, { intents?, guide? })` builds the `GolemKindContribution` the golem lists. `guide` is the URL of a Markdown file an agent reads when it opens an asset of the kind; the MCP server reads it only then. A package exports its contributions typed as `GolemKindList`.
- `golemIntent({ description, input, run })` builds one intent: a named operation an agent runs through the MCP server's `asset_intent`. `input` is a zod schema, which agents see as JSON Schema; `run(asset, input)` gets the parsed input. An input the schema rejects fails with `IntentInputError` before `run`. Give the asset a method of the same name that takes the schema's `z.output` and returns the answer, so `run` only forwards the input and scripts call the same method.
- `AssetOpening` is what the golem hands a new asset: its room, an abort signal, `onClose` and an `AssetStudio`. `GolemAsset` keeps the first three to itself and exposes the `AssetStudio` as the protected `studio`: the catalog, the studio manifest's editors as `unknown[]` (a kind parses the fields it reads, as the scene parses `sceneComponents`), and `open` for kinds that need another asset.
- `resolveEntry` finds an entry by id, or by a name only one entry has. It and the errors kinds throw (`UnknownEntryError`, `UnknownAssetError`, `KindMismatchError`, `LockedByPeerError`) live here so every kind reports them the same way.
- `GolemAssets` maps kind names to asset classes. A contribution adds its kind to it, so `golem.open(id, kind)` returns the right class.

## Contributing a kind

Put the golem code in the asset package's `src/golem/` folder, with its entry `src/golem/index.ts` exported as `./golem` and named in the package's `package.json` as `"jollypixel": { "golem": "./golem" }`, the field the studio reads for its other contributions. The entry exports `GOLEM_KINDS`, the package's contributions, and adds its kinds to `GolemAssets`. Keep the guide in `src/golem/guide.md` and have the build copy it to `dist/golem/` (`tsc -b && node -e "fs.cpSync('src/golem/guide.md', 'dist/golem/guide.md')"`), so `new URL("./guide.md", import.meta.url)` finds it from both folders. When the studio lists the package in its project, the golem imports that entry. It resolves the package from its `projectRoot`, so the package must be installed there, or sit in the project for a local one. A kind without a `jollypixel.golem` entry gets no AI support: the golem never sends raw commands for a kind it has no code for, and never runs code the studio serves.

```ts
import {
  golemIntent,
  golemKind,
  type GolemKindList
} from "@jolly-pixel/golem.kit";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    environment: EnvironmentAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  golemKind(environmentEditableKind(), EnvironmentAsset, {
    guide: new URL("./guide.md", import.meta.url),
    intents: {
      change: golemIntent({
        description: "Change the sky, sun, fog...",
        input: environmentChangeSchema,
        run: (asset: EnvironmentAsset, input) => asset.change(input)
      })
    }
  })
];
```

Every first-party kind is built this way: `@jolly-pixel/asset.scene/golem`, `@jolly-pixel/asset.script/golem`, `@jolly-pixel/asset.voxel-map/golem`, `@jolly-pixel/asset.voxel-model/golem`, `@jolly-pixel/asset.pixel-art/golem` and `@jolly-pixel/asset.environment/golem`.

## Testing a kind

`@jolly-pixel/golem.kit/testing` opens a kind without a server, so an asset package tests its golem code in its own `test/golem/`.

```ts
import { TestStudio } from "@jolly-pixel/golem.kit/testing";

const studio = new TestStudio({ kinds: GOLEM_KINDS, editors: [] });
const hosted = studio.host("environments/dusk.environment.json", environmentAssetKind());
const environment = await studio.open(hosted.id, "environment");

await environment.change({ fog: { kind: "exp2", density: 0.05 } });
await environment.settled();
hosted.state; // the studio's state of the asset
```

- `new TestStudio({ kinds, editors? })` opens the contributions in `kinds`; `editors` is what `studio.editors` answers.
- `host(path, handler)` adds an asset served by its kind's `AssetKindHandler` and returns `{ id, state, room }`. Change `state` before `open` to start from a given document. `record(record)` adds a catalog entry nothing serves, for references, and `dependencies` is the catalog's `DependencyIndex`.
- `open(assetId, kind)` opens the asset once and waits for `ready`, as `golem.open` does. Assets opened through `studio.open` come from the same test studio.
- `TestRoom` answers each command the golem sends right away. `holdAnswers()` keeps them until `answer()`. `sent` lists every command sent and `presence` the golem's own presence. Set `access` to `"read"` to play a role that may only read.
- `room.receive(command)` applies a person's command in the studio. The golem sees it with the answer to its next command, so a test can make a golem command conflict with it. `deny(event, reason)` plays a denial, and `addPeer(peer)` adds a peer whose presence holds a lock.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/golem.kit build
```

The kit has no tests of its own: each asset package's `test/golem/` covers it through its kind, `GolemAsset` and `SentCommands` through the scene's.

## License

MIT

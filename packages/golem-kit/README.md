## 📌 About

Private workspace holding the contract between the golem and an asset kind. An asset package implements it so golems can open its kind, without depending on `@jolly-pixel/golem`.

- `GolemAsset` is the base class of one open asset: it checks a batch against the kind's command schema and the peer's rights, applies it through the kind's `localEdits`, and tracks the studio's answers. A subclass adds `read()`, `focus(commands)` and methods that build commands and call `apply`.
- `golemKind(editableKind, Asset, { intents?, guide? })` builds the `GolemKindContribution` the golem lists. `guide` is the URL of a Markdown file an agent reads when it opens an asset of the kind; the MCP server reads it only then. A package exports its contributions typed as `GolemKindList`.
- `golemIntent({ description, input, run })` builds one intent: a named operation an agent runs through the MCP server's `asset_intent`. `input` is a zod schema, which agents see as JSON Schema; `run(asset, input)` gets the parsed input. An input the schema rejects fails with `IntentInputError` before `run`.
- `AssetOpening` is what the golem hands a new asset: its room, the catalog, the studio manifest's editors as `unknown[]` (a kind parses the fields it reads, as the scene parses `sceneComponents`), an abort signal, and `open` for kinds that need another asset.
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
import * as z from "zod/mini";

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
        input: z.object({ /* ... */ }),
        run: async(asset: EnvironmentAsset, { preset, ...patch }) => {
          return { changed: await asset.change(patch, { preset }) };
        }
      })
    }
  })
];
```

Every first-party kind is built this way: `@jolly-pixel/asset.scene/golem`, `@jolly-pixel/asset.script/golem`, `@jolly-pixel/asset.voxel-map/golem`, `@jolly-pixel/asset.voxel-model/golem`, `@jolly-pixel/asset.pixel-art/golem` and `@jolly-pixel/asset.environment/golem`.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/golem.kit build
```

The golem's tests cover this package through real assets.

## License

MIT

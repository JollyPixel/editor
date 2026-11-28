# golemKind

`golemKind(documentKind, Asset, { intents?, guide? })` builds the `GolemKindContribution` the golem lists for one kind. `documentKind` is the kind's editable document kind, and `Asset` is its `GolemAsset` subclass.

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

- `guide` is the URL of a Markdown file an agent reads when it opens an asset of the kind. The MCP server reads it only then.
- Adding the kind to `GolemAssets` types `golem.open(id, "environment")` as an `EnvironmentAsset` once the entry is imported. Without it, `open` returns a `GolemAsset`.

## Intents

`golemIntent({ description, input, run })` builds an intent: a named edit that an agent runs through the MCP server's `asset_intent`. `input` is a zod schema, which agents see as JSON Schema. `run(asset, input)` receives the parsed input. Input that the schema rejects throws `IntentInputError` before `run` is called.

Give the asset a method with the intent's name that takes the schema's `z.output` and returns the answer. `run` then only forwards the input, and scripts call the same method.

## Shipping a kind

The golem code lives in the asset package's `src/golem/`. Its entry, `src/golem/index.ts`, exports `GOLEM_KINDS` and is declared in `package.json`:

```json
{
  "exports": {
    "./golem": {
      "types": "./dist/golem/index.d.ts",
      "default": "./dist/golem/index.js"
    }
  },
  "jollypixel": {
    "golem": "./golem"
  },
  "scripts": {
    "build": "tsc -b && node -e \"fs.cpSync('src/golem/guide.md', 'dist/golem/guide.md')\""
  }
}
```

The build copies the guide next to the built entry, so `new URL("./guide.md", import.meta.url)` resolves from `src/` and from `dist/`.

When the studio lists the package in its project, the golem resolves it from the project's root and imports that entry. The package must therefore be installed in the project or sit inside it. A kind without a `jollypixel.golem` entry gets no AI support. The golem never sends raw commands for a kind it has no code for, and never runs code the studio serves.

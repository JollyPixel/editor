Contract and test studio for asset kinds that support golems

## 💃 Getting Started

This workspace-private package is never published. An asset package depends on
it to add golem support to its kinds:

```json
{
  "dependencies": {
    "@jolly-pixel/golem.kit": "workspace:*"
  }
}
```

Consumers load the built `dist/` output, so run
`pnpm --filter @jolly-pixel/golem.kit build` after a change.

## 💡 About

A golem opens an asset only when the asset's package supports its kind. The
package's `golem` entry exports `GOLEM_KINDS`: for each kind, a `GolemAsset`
subclass that turns edits into the kind's commands, the intents an agent can
run, and a guide for agents. The kit holds that contract, so asset packages
never depend on `@jolly-pixel/golem`.

## 👀 Usage example

```ts
import {
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
    guide: new URL("./guide.md", import.meta.url)
  })
];
```

## 📚 API

- [GolemAsset](./docs/GolemAsset.md): the base class of an open asset, `resolveEntry` and the errors kinds share.
- [golemKind](./docs/golemKind.md): a kind's contribution, its intents, and how the golem finds a package's kinds.
- [TestStudio](./docs/TestStudio.md): opening a kind in tests without a server.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

The kit has no tests of its own. Each asset package's `test/golem/` covers it
through its kind, and the scene's covers `GolemAsset` and `SentCommands`.
After a change, run:

```bash
$ pnpm --filter @jolly-pixel/golem.kit build
$ pnpm run typecheck
$ pnpm run lint
```

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md

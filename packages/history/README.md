<h1 align="center">
  history
</h1>

<p align="center">
  Command documents and per-person undo history that survives collaboration
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/history
# or
$ yarn add @jolly-pixel/history
```

## 👀 Usage example

`stats` is a [CommandDocument](./docs/CommandDocument.md) of named numbers, edited with `{ key, value }` commands through `set(key, value)` and read with `get(key)`. It starts with `hp` at 10.

```ts
import {
  CommandHistory,
  KeyedGuard
} from "@jolly-pixel/history";

const history = new CommandHistory<"build">();
history.register({
  id: "stats",
  document: stats,
  keys: {
    // the keys a change wrote
    written: ({ command }) => [command.key],
    // the values an undo of these commands writes back, which nobody else may change meanwhile
    guard: (commands) => new KeyedGuard(commands.map(({ key }) => {
      return { key, read: () => stats.get(key) };
    }))
  },
  // a change made outside record() becomes its own step in this scope
  scopeOf: () => "build"
});

history.record("build", "Set hp", () => stats.set("hp", 20));
history.undo("build"); // true, hp is 10 again
```

An undo never erases a peer's newer edit. When a peer wrote the same value, the step is refused and undo skips it:

```ts
history.record("build", "Set hp", () => stats.set("hp", 20));
stats.apply({ key: "hp", value: 99 }, "peer-1");
history.undo("build"); // false, emits "skipped", hp stays 99
```

A drag spanning several events opens a step and commits it at the end:

```ts
const step = history.open("build", "Paint");
// pointer moves edit the document
step.commit();
```

## 📚 API

### Core

What an editor uses to add undo to its documents.

- [CommandHistory](./docs/CommandHistory.md): scopes, record, undo, redo and state.
- [HistoryRegistration](./docs/HistoryRegistration.md): registered documents, `HistorySource`, guards and `KeyedGuard`.
- [CommandDocument](./docs/CommandDocument.md): base class of a document edited by commands.

### Integration

What sync clients and custom history sources use.

- [CommandChange](./docs/CommandChange.md): the change a history source emits, built per origin.
- [ChangeReceipts](./docs/ChangeReceipts.md): the server's answers a sync client writes.
- [ChangeSourceAdapter](./docs/ChangeSourceAdapter.md): a history source over a document that emits plain changes.

The [collaborative undo guide](./docs/guides/collaborative-undo.md) explains steps, guards, refusals and receipts.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit together and [GLOSSARY.md](./GLOSSARY.md) for the terms used by the package.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md

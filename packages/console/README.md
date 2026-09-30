<h1 align="center">
  console
</h1>

<p align="center">
  Command palette and developer console for JollyPixel's editors
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/console
# or
$ yarn add @jolly-pixel/console
```

The root entry has no DOM and no dependency on Lit. The `jolly-console`
element lives in `@jolly-pixel/console/element`, which needs the `lit` and
`@jolly-pixel/ui` peers.

## 👀 Usage example

```ts
import { CommandConsole } from "@jolly-pixel/console";
import "@jolly-pixel/console/element";

const commands = new CommandConsole();

const brush = commands.registerNamespace("brush", {
  description: "Voxel brush"
});
brush.registerVariable("size", {
  type: "number",
  description: "Brush size in voxels",
  get: () => brushStore.size,
  set: (value) => {
    brushStore.size = value;
  }
});
brush.registerCommand("grow", {
  description: "Grow or shrink the brush",
  args: [
    { name: "delta", type: "number", required: true }
  ],
  execute: ({ delta }, ctx) => {
    brushStore.resize(delta);
    ctx.print(`brush size ${brushStore.size}`);
  }
});

const element = document.createElement("jolly-console");
element.console = commands;
document.body.append(element);
```

Ctrl+K (Cmd+K on macOS) opens the console. It accepts three kinds of input:

| Input | Mode | Enter |
| --- | --- | --- |
| `/brush.grow 2` | command | runs the command |
| `brush.size` or `brush.size 3` | variable | reads or writes the variable |
| anything else, or `?text` | search | acts on the highlighted result |

Name the instance `commands`: a binding named `console` shadows the global.
Construct one per editor page and pass it down; the package exports no
instance.

## 📚 API

- [CommandConsole](./docs/CommandConsole.md): namespaces, commands, variables, output and history
- [Registering from features](./docs/features.md): `ConsoleFeature` and `registerConsoleFeatures`
- [Input grammar](./docs/grammar.md): the three modes, coercion, search and completion
- [jolly-console](./docs/element.md): mounting the element, keys and accessibility

## 🧪 Benchmarks

The suite measures a search, a classification and a completion against 500
registered entries, the work done on every keystroke.

```bash
pnpm --filter @jolly-pixel/console bench
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run test:e2e
$ pnpm run lint
```

`pnpm run dev` serves the example page on port 3006. The Playwright suite runs
against it. The element imports `@jolly-pixel/ui` from its `dist/`, so rebuild
`ui` after changing it.

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md

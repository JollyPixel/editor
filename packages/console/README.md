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

Ctrl+K (Cmd+K on macOS) opens the console.

## 📚 API

- [CommandConsole](./docs/CommandConsole.md): namespaces, commands, variables, reverting, output and history
- [Registering from features](./docs/features.md): `ConsoleFeature` and `registerConsoleFeatures`
- [Input grammar](./docs/grammar.md): the three modes, coercion, search, completion and scripts
- [jolly-console](./docs/element.md): mounting the element, keys and accessibility
- [Remote consoles](./docs/remote.md): `ConsoleServer` and `ConsoleMirror`, a console served over a `MessagePort`

## 🧪 Benchmarks

The Node suites measure the work done on every keystroke: tokenizing and
classifying a line, then a search, a browse and a completion against 500
registered entries, with a second search suite at 5000 entries.

```bash
pnpm --filter @jolly-pixel/console bench
```

The browser suite mounts `jolly-console` in headless Chromium with Lit's
production build, fills the scrollback to its 500-entry capacity and times
each keystroke until layout is clean. `KB/op` is the heap growth over 40
operations after a forced GC, with a young generation large enough that no
collection runs in between.

```bash
pnpm --filter @jolly-pixel/console bench:browser
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run test:e2e
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

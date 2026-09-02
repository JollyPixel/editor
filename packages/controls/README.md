<h1 align="center">
  controls
</h1>

<p align="center">
  Input controls (Screen, Mouse, Touchpad, Keyboard, Gamepad)
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/controls
# or
$ yarn add @jolly-pixel/controls
```

## 👀 Usage example

```ts
import { Input } from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}
const input = new Input(canvas);

input.connect();

function gameLoop() {
  input.update();

  if (input.keyboard.wasJustPressed("Space")) {
    console.log("Jump!");
  }
  if (input.mouse.isDown("left")) {
    const delta = input.mouse.viewportDelta(true);
    console.log("Dragging", delta.x, delta.y);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

For advanced input combinations:

```ts
import { InputCombination } from "@jolly-pixel/controls";

const dashCombo = InputCombination.all(
  InputCombination.key("ShiftLeft"),
  InputCombination.key("ArrowRight")
);
if (dashCombo.evaluate(input)) {
  console.log("dash!");
}
```

## 📚 API

- [Input](./docs/input.md)
  - [Mouse](./docs/mouse.md)
  - [Keyboard](./docs/keyboard.md)
  - [Gamepad](./docs/gamepad.md)
  - [Touchpad](./docs/touchpad.md)
  - [Screen](./docs/screen.md)
- [AxisMap](./docs/axismap.md): named scalar axes built from keys, mouse
  buttons, and gamepad sticks.
- [InputCombination](./docs/combinedinput.md): composable input conditions for
  chords, alternatives, exclusions, and sequences.
- [InputActionQuery](./docs/inputactionquery.md): dispatch helper for
  `"ANY"`, `"NONE"`, and concrete actions.

## 🧪 Benchmarks

The suites cover device updates, state queries, input combinations, axis
resolution, and DOM event dispatch. They use headless adapters, so event benchmarks report
`getBoundingClientRect()` call counts instead of browser layout timings.

```bash
npm run bench -w @jolly-pixel/controls
```

Use `-- --list` to inspect the suites. Filtering and measurement rules are
documented by [`@jolly-pixel/bench`](../bench/README.md).

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md

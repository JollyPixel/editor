<h1 align="center">
  controls
</h1>

<p align="center">
  HTML5 Input controls (Screen, Mouse, Touchpad, Keyboard, Gamepad)
</p>

## 💡 Features

TBC

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
    const delta = input.mouse.getViewportDelta(true);
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
- [CombinedInput](./docs/combinedinput.md): composable input conditions (AND, OR, NOT, sequence) for complex key bindings.

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

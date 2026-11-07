# @jolly-pixel/utils

Small standalone helpers shared by the JollyPixel workspaces: type guards,
error normalization, number helpers, base64 and a serial task queue. The root
entry point runs in browsers and Node.js; `@jolly-pixel/utils/dom` holds the
helpers that need a `document`. The [ROADMAP](./ROADMAP.md) lists the helpers
still waiting to move here.

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/utils
# or
$ yarn add @jolly-pixel/utils
```

## 👀 Usage example

```ts
import {
  errorMessage,
  formatBytes,
  is
} from "@jolly-pixel/utils";
import { saveFile } from "@jolly-pixel/utils/dom";

const theme = localStorage.getItem("theme");
if (is.member(theme, ["light", "dark"])) {
  theme;  // "light" | "dark"
}

try {
  const blob = await exportLevel();
  saveFile(blob, `level (${formatBytes(blob.size)}).json`);
}
catch (error) {
  console.warn(`Export failed: ${errorMessage(error)}`);
}
```

## 📚 API

- [is](./docs/is.md): `is.object`, `is.plainObject`, `is.member`
- [Errors](./docs/error.md): `asError`, `errorMessage`
- [Numbers](./docs/number.md): `clamp`, `formatBytes`
- [Base64](./docs/base64.md): `encodeBase64`, `encodeBase64Url`, `decodeBase64`
- [TaskChain](./docs/TaskChain.md): runs async tasks one at a time
- [DOM](./docs/dom.md): `saveFile`

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

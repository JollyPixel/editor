<h1 align="center">
  fs-tree-backend
</h1>

<p align="center">
  Back-end implementation of a FileSystem tree
</p>

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/fs-tree-backend
# or
$ yarn add @jolly-pixel/fs-tree-backend
```

## 👀 Usage example

```ts
import {
  FSTree,
  type FSTreeFile
} from "@jolly-pixel/fs-tree-backend";

interface CustomFSNode extends FSTreeFile {
  type: "script";
}

const fsTree = await FSTree.loadFromPath<CustomFSNode>(
  process.cwd(),
  (dirent) => {
    return {
      name: dirent.name,
      type: "script"
    };
  }
);
console.log(fsTree.toJSON());
fsTree.on(FSTree.Event, (op) => {
  console.log("tree updated op:", op);
});

fsTree.mvdir("/src/utils", "/src/helpers");
fsTree.copy(
  { parentPath: "/src", name: "types.ts" },
  "/src/helpers"
);
```

## 📚 API

- [FSTree](./docs/FSTree.md)
- [FSTreeSynchronizer](./docs/FSTreeSynchronizer.md)

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

### 🚀 Running the examples

One interactive example live in the `examples/` directory and are served by Vite. Start the dev server from the package root:

```bash
npm run preview -w @jolly-pixel/fs-tree
```

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md

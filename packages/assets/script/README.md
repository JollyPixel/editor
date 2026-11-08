## 📌 About

Private asset workspace for scripts (kind `script`), TSL shaders (kind `shader`) and other text files (kind `text`). A script asset is a plain `.ts` or `.js` file; new scripts start from a `Behavior` template. A shader asset is a `.tsl.ts` file, which wins over `.ts` because the longest matching extension picks the kind; new shaders start from a template whose default export returns a `MeshStandardNodeMaterial`. A text asset is a `.md`, `.txt`, `.json`, `.jsonc`, `.yml`, `.yaml`, `.toml`, `.xml`, `.html` or `.css` file and starts empty. All three load as UTF-8, their line endings become LF, and they share the edit protocol below; only scripts have an outline.

- Edits are text changes (`{ at, insert }` or `{ at, delete }`, in UTF-16 offsets). The room orders them: it rebases each edit over the edits committed since its `basis` version, using operational transform (`TextEdit.rebaseOnto`), and appends the result. A client keeps one edit in flight and folds the next keystrokes into it until the room acknowledges it.
- A room keeps the last 1,000 committed edits. An edit based on an older version, or one whose deleted text no longer matches, is refused and its author resyncs from the snapshot.
- `ScriptDocument` holds the text and an undo history of the local edits, rebased over peer edits so an undo never reverts someone else's work.
- The outline lists each `Behavior` class with its `@SceneProperty` fields (type, label, description, default). A client asks for it with `ScriptOutlineFeed.request()`; the room parses the text with [ts-morph](https://github.com/dsherret/ts-morph) and sends it to every member. ts-morph loads on the first request, in Node only: the browser build of the kind answers no outline.

Browser code imports `@jolly-pixel/asset.script/client`. The package root pulls in server dependencies.

`@jolly-pixel/asset.script/markdown` registers `<jolly-markdown>`. Set its `markdown` property and it renders that text as HTML with [marked](https://github.com/markedjs/marked), sanitized by [DOMPurify](https://github.com/cure53/DOMPurify). Links open in a new tab. The script editor uses it for its preview, and the studio home for the project README.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.script build
```

The kind loads its outline reader from `dist/`, so tests and editors need a build first.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.script test
$ pnpm --filter @jolly-pixel/asset.script lint
```

Convergence specs drive several clients against a real `LiveAssetRoom` and use fast-check to replay random edits, undos and deliveries.

## License

MIT

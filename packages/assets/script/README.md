`.ts` and `.js` scripts, `.tsl.ts` shaders and text files

## 📌 About

Private asset workspace for three text kinds:

- `script`: a `.ts` or `.js` file, created from a `Behavior` template with empty `awake()` and `start()`. The class is named after the file: `enemy-spawner.ts` declares `EnemySpawnerBehavior`.
- `shader`: a `.tsl.ts` file (it wins over `.ts`), created from a template that returns a `MeshStandardNodeMaterial`.
- `text`: a `.md`, `.txt`, `.json`, `.jsonc`, `.yml`, `.yaml`, `.toml`, `.xml`, `.html`, `.css` or `.editorconfig` file, created empty.

All three load as UTF-8. The room edits the text with LF line endings and refuses an edit that inserts a carriage return. It saves the file with the `end_of_line` of its `.editorconfig`, or else with the file's own ending: a CRLF file stays CRLF, and a file mixing both takes its first one. They share one edit protocol:

- An edit is `{ at, insert }` or `{ at, delete }` in UTF-16 offsets. The room rebases it over the edits committed since its `basis` version and keeps the last 1,000.
- An edit based on an older version, or whose deleted text no longer matches, is refused; its author resyncs from the snapshot.
- `ScriptDocument` holds the text and a local undo history that never reverts a peer's edit.

When a room opens, it reads the `.editorconfig` files from the file's folder up to the project root, stopping at one with `root = true`. The snapshot carries the resulting `TextFormat`: `indent_style`, `indent_size` and `tab_width`, which the document exposes as `format`. Without a setting the indent is two spaces. `end_of_line` (`lf` or `crlf`) applies when the room saves. Other properties are ignored, `insert_final_newline` and `trim_trailing_whitespace` included: changing the text on save would break the replay of later edits. A change to an `.editorconfig` reaches a room the next time it opens.

Scripts have an outline: each `Behavior` class with its `@SceneProperty` fields. Request it with `ScriptOutlineFeed.request()`; only a Node server answers.

Scripts and shaders can be linted with oxlint. `ScriptLintFeed.request()` asks the server to lint the room's current text, and `change` fires only when the diagnostics are for the text the peer holds. The server runs one lint at a time per room and answers everyone who asked while it ran.

Scripts and shaders build to `text/javascript` with `buildScript` or `buildShader` from `@jolly-pixel/scripting`. A refused import, a dynamic import or a syntax error fails the build. Scripts build in Node only.

Browser code imports `@jolly-pixel/asset.script/client`; the package root pulls in server dependencies. The golem entry (`@jolly-pixel/asset.script/golem`, `src/golem/`) is what gives agents this kind: see [Golem](./docs/Golem.md).

The runtime entry (`@jolly-pixel/asset.script/runtime`) runs scripts and shaders in a game. Its `Script` component is the engine's `ScriptDefinition`, which takes the behavior from the exports of the slotted script. It registers the script and shader loaders of `@jolly-pixel/scripting/three`, which link each build against the game's own three.js and engine.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.script build
```

Tests and editors load this package and `@jolly-pixel/scripting` from `dist/`, so build both first: `pnpm --filter "@jolly-pixel/asset.script..." build`.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.script test
$ pnpm --filter @jolly-pixel/asset.script lint
```

Convergence specs drive several clients against a real `LiveAssetRoom` and use fast-check to replay random edits, undos and deliveries.

## License

MIT

## 📌 About

Private editor workspace for `@jolly-pixel/asset.script` scripts and text files, booted through `@jolly-pixel/editor.host`.

- The code view is a transparent `<textarea>` over the highlighted lines. Highlighting uses Shiki's JavaScript regex engine with the grammar of the file extension (TypeScript, JavaScript, JSON, YAML, TOML, XML, HTML, CSS or Markdown), loaded on demand. A `.txt` file is not highlighted. Each line keeps its tokenizer state, so an edit retokenizes from its line until the state matches again. Only the visible lines render.
- Peers see each other's carets and selections. Tab and Shift+Tab indent, Enter keeps the indentation, and Ctrl+Z / Ctrl+Y undo and redo local edits only.
- The Outline pane shows the behaviors and scene properties the room reads from the script. Text files have no Outline pane.
- A Markdown file opens next to a rendered preview, updated 150 ms after the last edit. A member who cannot edit sees the preview only.

The package also contributes the scene `Script` component (`jollypixel.scene`, export `./scene`). Its script slot takes a script asset; the inspector then offers that script's behaviors and lists the picked behavior's properties with their types and defaults. The standalone scene editor loads no component package, so try it through the studio.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.script dev
```

The dev server seeds `scripts/PlayerBehavior.ts` under `assets/`; delete that directory to seed it again.

`window.scriptEditor.document` exposes the script document from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.script test
$ pnpm --filter @jolly-pixel/editor.script test:e2e
$ pnpm --filter @jolly-pixel/editor.script lint
```

The Playwright suite types into two pages at once, which no DOM mock can reproduce.

## License

MIT

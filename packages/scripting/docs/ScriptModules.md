# ScriptModules

The scripts of a game, found by the path a script imports them with.

```ts
import { ScriptModules } from "@jolly-pixel/scripting";

const scripts = new ScriptModules(catalog);
const imported = await scripts.imported(record, code);
```

A path names the script at that exact path first, then `x` names `x.ts`, then
`x.js` names `x.ts`. With both `util.ts` and `util.js` in the game, `util.js`
names `util.js` and `util` names `util.ts`.

`SCRIPT_KIND` is the asset kind of a script, `"script"`.

## Constructor

```ts
new ScriptModules(records: Iterable<AssetRecord>);
```

Keeps the records of kind `SCRIPT_KIND` and ignores the others. Later changes
to `records` are not seen.

## Methods

### resolve(path: string): AssetRecord | undefined

The script `path` names, or `undefined`. `path` is relative to the project
root.

### entries(): IterableIterator\<[string, AssetRecord]\>

Every path that names a script, with the script it names. A game's import map
lists each of them.

### imported(importer: AssetRecord, code: string): Promise\<AssetRecord[]\>

The scripts the built `code` of `importer` imports with a `./` or `../` path,
in import order. Bare specifiers are skipped. Throws a
[`ScriptImportError`](./ScriptImportPolicy.md#scriptimporterror) for a path
that names no script, and for a dynamic `import()`.

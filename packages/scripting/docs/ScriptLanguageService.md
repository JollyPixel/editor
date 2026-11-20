# ScriptLanguageService

Runs the TypeScript language service over one script or shader: its type
errors, completions and quick info. It runs in a browser, where the script
editor starts it in a Web Worker.

```ts
import { ScriptLanguageService } from "@jolly-pixel/scripting/language";
import files from "@jolly-pixel/scripting/types";

const service = new ScriptLanguageService(files, "scripts/Player.ts");
const diagnostics = service.diagnostics(text);
const completions = service.completions(text, offset);
```

`@jolly-pixel/scripting/types` default-exports the declaration files a script
type-checks against, keyed by their path in a virtual file system: the
TypeScript `es2023` and `dom` libraries, and the types of every module
[`SCRIPT_IMPORTS`](./ScriptImportPolicy.md) and `SHADER_IMPORTS` allow. The
build collects them, about 4.5 MB of text.

## Constructor

### new ScriptLanguageService(files: ScriptTypeFiles, path: string)

- `files`: `Readonly<Record<string, string>>`, the declaration files.
- `path`: the asset path. Its extension picks TypeScript or JavaScript.

Scripts check in `strict` mode. An import of another script by relative path
reports nothing: the service sees one script at a time.

## Methods

Each method takes the current text of the script and type-checks it again only
when it changed.

### diagnostics(text: string): ScriptDiagnostic[]

Syntax and type errors, in the [`ScriptDiagnostic`](./lintScript.md#schema)
shape. `code` reads `ts(2322)`.

### completions(text: string, offset: number): ScriptCompletion[]

What can be written at `offset`, keeping the names that start with the word
before it (ignoring case), sorted the way TypeScript ranks them. At most 100.

```ts
interface ScriptCompletion {
  name: string;
  kind: string;
  insertText: string;
  start: number;
  length: number;
}
```

`start` and `length` give the text that `insertText` replaces, usually the
word before `offset`.

### quickInfo(text: string, offset: number): ScriptQuickInfo | null

The signature and documentation of the symbol at `offset`, or `null` when
there is none.

```ts
interface ScriptQuickInfo {
  start: number;
  length: number;
  signature: string;
  documentation: string;
}
```

### dispose(): void

Releases the language service.

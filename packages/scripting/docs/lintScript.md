# lintScript

Lints the text of a script or shader with
[oxlint](https://oxc.rs/docs/guide/usage/linter), for the problems the editor
underlines.

```ts
import { lintScript } from "@jolly-pixel/scripting";

const diagnostics = await lintScript("debugger;\n");
// [{ start: 0, length: 9, severity: "warning", message: "`debugger` statement is not allowed", code: "eslint(no-debugger)" }]
```

## lintScript(text: string): Promise\<ScriptDiagnostic[] | null\>

Writes the text to a temporary `.ts` file and runs the `oxlint` CLI on it, so
each call costs about 100 ms. Only the `correctness` rules run, as warnings.

- A syntax error comes back as an `error`, and oxlint then reports nothing
  else for that text.
- `start` and `length` count UTF-16 code units, like a JavaScript string.
- `code` is the rule, such as `eslint(no-debugger)`, or `null` for a syntax
  error.

The browser build always answers `null`.

## Schema

`scriptDiagnosticSchema` is the `zod/mini` schema of a diagnostic, used to
validate the diagnostics received over the network. The
[language service](./ScriptLanguageService.md) answers with the same shape.

```ts
type ScriptDiagnosticSeverity = "error" | "warning";

interface ScriptDiagnostic {
  start: number;
  length: number;
  severity: ScriptDiagnosticSeverity;
  message: string;
  code: string | null;
}
```

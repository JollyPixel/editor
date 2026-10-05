# Code Style

## Imports

Order import blocks as Node.js (`node:`), third-party, then internal. Prefix
each block with `// Import <Kind> Dependencies`. Internal imports require `.ts`
extensions; type-only imports require `import type`. Put each named import or
export on its own line when the list has more than two members.

## Naming

| Item | Convention | Example |
|---|---|---|
| Class, interface, type | `PascalCase` | `HttpServer` |
| Variable, function, method | `camelCase` | `fetchData` |
| Private field or method | `#camelCase`; never TS `private` | `#connectionPool` |
| Exported constant | `ALL_CAPS` | `API_URL` |
| File-local constant | `kPascalCase` | `kTimeoutMs` |
| Type parameter | `TPascalCase` | `TData` |
| Unused parameter | `_` prefix | `_unused` |

## Value Objects and Intent

- Model domain concepts with small value objects when they own invariants or
  meaningful operations; keep validation and normalization inside them.
- Prefer immutable value objects. Copy mutable inputs at boundaries and return
  copies rather than exposing internal mutable state.
- Name APIs after their intent and behavior (`applyDelta`, `fitsWithin`,
  `rowsWithin`), not their implementation. Document units, defaults,
  mutability, bounds, and out-of-bounds behavior when they are not obvious.
- Do not prefix methods with `get`/`set`. Use a real getter/setter pair when
  the member reads as a property (`set state(value)`), otherwise name the
  method after what it does (`copySizeTo`, `toBox3`, `resize`, `emphasize`,
  `hover`). Reserve the prefixes for accessors mandated by an external API.

## Comments

Write no comments in `src/`, `test/`, `bench/`, or e2e suites: no JSDoc on
classes, methods, or types, and no notes on invariants or expectations. Names,
signatures, and `it()` titles carry the meaning. Prose goes to `docs/*.md`
(public API), `ARCHITECTURE.md` (internals), or the package README (bench and
test-harness rationale).

- Allowed: `// Import <Kind> Dependencies` and `// CONSTANTS` headers, bare
  `eslint-disable*` and `@ts-expect-error` directives, license headers of
  ported code, generated files, and JSDoc on properties of user-facing
  interfaces.
- Never restore a removed comment, and patch files instead of rewriting them
  whole (that brings trimmed comments back). Leave existing comments outside
  your change unless asked. Run lint after removing comments to catch empty
  blocks.
- Format: own preceding line, compact and factual, multi-line on three lines,
  no em dash (in docs too), and no unescaped backtick in Lit `css`/`html`
  templates (quote identifiers instead).

## Style

- Use double quotes, semicolons, strict equality (`===`/`!==`), `const` by
  default, and `let` only when reassigned; never use `var`.
- Leave a blank line before `return`; keep code under 80 characters where
  practical.
- Put each function, method, and constructor parameter on its own line when
  there are more than two parameters.
- Use no space before arrow-function `()` (`async() => {}`); named methods keep
  the space (`async foo() {}`).
- Use `type` for unions/mapped types and `interface` for extendable object
  shapes. Never use `enum`, constructor parameter properties, or
  `namespace`/`module`; use `as const`, union literals, or explicit fields.
- Custom errors extend `Error`, use PascalCase names, and may accept `cause`.
- Put constants directly below imports under `// CONSTANTS`.
- Avoid unnecessary type casts (use `/typescript-magician` when needed) and
  inline object definitions; expand objects across lines.
- Expand non-trivial object literals across lines, with one property per line.
- Use the narrowest useful collection type: prefer `Iterable<T>` when a caller
  only needs traversal, and `Array<T>` when it needs length, indexing, or
  mutation. Return `IterableIterator<T>` for lazy iteration.

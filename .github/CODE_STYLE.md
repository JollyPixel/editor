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

## Style

- Multi-line comments should not be inlined (prefer them on three lines)
- Use double quotes, semicolons, strict equality (`===`/`!==`), `const` by
  default, and `let` only when reassigned; never use `var`.
- Put comments on their own preceding line, keep them compact and factual, and
  never use an em dash in comments or documentation.
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
- In Lit `css`/`html` template comments, never use an unescaped backtick;
  mention identifiers as plain text or in quotes instead.
- Use the narrowest useful collection type: prefer `Iterable<T>` when a caller
  only needs traversal, and `Array<T>` when it needs length, indexing, or
  mutation. Return `IterableIterator<T>` for lazy iteration.

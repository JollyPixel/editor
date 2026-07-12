# Code Style

## Imports

Order: Node.js (`node:` prefix) → third-party → internal, each block headed by `// Import <Kind> Dependencies`. Internal imports keep `.ts` extensions. Use `import type { ... }` for type-only imports.

## Naming

| Kind | Convention | Example |
|---|---|---|
| Class / Interface / Type | `PascalCase` | `class HttpServer` |
| Variable / Function / Method | `camelCase` | `fetchData` |
| Private field or method | `#prefix` — never the TS `private` keyword | `#connectionPool` |
| Exported constant | `ALL_CAPS` | `API_URL` |
| File-local constant | `k` + PascalCase | `kTimeoutMs` |
| Type parameter | `T` + PascalCase | `TData` |
| Unused param | `_` prefix | `_unused` |

## Style

- Double quotes, semicolons always, strict equality (`===`/`!==`)
- `const` by default, `let` when reassigned, never `var`
- Comments on their own preceding line, never inline end-of-line
- Blank line before `return`
- Arrow functions: no space before `()` — `async() => {}`. Named methods keep the space: `async foo() {}`
- `type` for unions/mapped types, `interface` for extendable object shapes
- No `enum` — use `as const` or union literal types
- Custom errors extend `Error`, PascalCase name, optional `cause`
- Constants directly beneath imports, under a `// CONSTANTS` comment

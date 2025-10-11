---
applyTo: "**/*.ts, **/*.mts, **/*.cts"
---

# TypeScript Coding Standards for This Project

These guidelines complement the existing **JavaScript** rules and are **binding** for all TypeScript source files.

---

## 1  Compiler Baseline (`tsconfig.json`)

The project’s `tsconfig.json` is **authoritative**. Do **not** change it.

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "NodeNext",
    "esModuleInterop": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "strict": true,
    "strictNullChecks": true,
    "noImplicitOverride": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,

    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "experimentalDecorators": true,
    "lib": ["es2022"]
  }
}
```

Key implications:

* **ESM only** (`module: "NodeNext"`, `verbatimModuleSyntax: true`).  Use `import`/`export`, never CommonJS `require`.
* **Target ES2022** → you may use class fields, `at()` on arrays, `Error.cause`, `RegExp matchIndices`, etc.
* **`strict` mode** with additional checks: treat all compile‑time warnings as **errors**.
* **`allowJs`: true** means you *may* import legacy `.js` files; new code **must** be `.ts`/`.tsx`.
* **Decorators** are enabled (`experimentalDecorators`). Use them sparingly and document intent.

---

## 2  General Style

(The JavaScript standards apply; this section covers TS‑specifics.)

| Topic                       | Rule                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Types vs Interfaces**     | Prefer **`type` aliases** for unions, mapped & conditional types. <br>Use **`interface`** for plain object shapes intended for extension.                 |
| **Explicit typing**         | Always annotate **public APIs** (exported functions, class members, constants) with explicit types.<br>Local variables may rely on inference if trivial. |
| **`any` / `unknown`**       | `any` is allowed by config but **should be avoided**; use `unknown` with proper narrowing.                                                               |
| **Nullish values**          | Handle `null` / `undefined` explicitly (`strictNullChecks`). Use the *nullish coalescing* operator (`??`) or early returns.                              |
| **Enums**                   | Avoid `enum`; prefer `as const` objects or union literal types for safer exhaustiveness.                                                                 |
| **Tuples & readonly**       | Mark tuples as `readonly` when contents shouldn’t mutate (`readonly [T1, T2]`).                                                                          |
| **Generics**                | Provide descriptive parameter names (`TData`, `TError`). Supply default type parameters when helpful.                                                    |
| **Decorators**              | Keep decorator logic *pure*; avoid hidden side‑effects. Document with JSDoc above the decorator.                                                         |
| **Assertions & type casts** | Prefer `as` casting; avoid the angle‑bracket form. Keep casts to the narrowest scope possible.                                                           |
| **Error handling**          | Use custom `class`es extending `Error` with a descriptive **PascalCase** name and optional `cause`.                                                      |

---

## 3  Imports & Module Resolution

1. **Order** exactly as in the JavaScript guide: core → third‑party → internal.
   Always include file extensions (e.g. `"./util.js"`).
2. **JSON modules** can be imported directly (`resolveJsonModule: true`).

   ```ts
   import packageJson from "../package.json" assert { type: "json" };
   ```
3. **Type‑only imports**: use the `import type { … } from "…";` form to avoid runtime overhead.
4. Keep each import statement **on its own line**.

---

## 4  Naming Conventions

Follow the same table as the JavaScript guide, with additions:

* **Type parameters**: `T`, `TValue`, `TOptions` (PascalCase prefixed with `T`).
* **Namespace imports** (rare): camelCase (e.g. `import * as fs from "node:fs/promises";`).

---

## 5  Testing

* Write tests in **TypeScript** (preferred extension `.spec.ts`).
* Use **Node.js core test runner** (`node:test`). Configure the runner to load `tsx` or `ts-node/register` for runtime transpilation.

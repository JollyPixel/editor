---
applyTo: "**/*.js, **/*.mjs, **/*.cjs"
---

# Coding Standards for This Project

## 1  Language & Runtime

* Write all source files in **modern JavaScript (ECMAScript 2024)**.
* Target **Node.js 22 or newer** and use native **ESM** syntax (`import`/`export`).

## 2  General Style

* Prefer **clarity over cleverness**; strive for readable, maintainable code.
* Always use **async/await** for asynchronous operations.
  * When converting callback APIs, use `node:util` → `promisify`.
* **Strings:** use **double quotes** (`"…"`) or **template literals** (\`…\`); never single quotes.
* **Semicolons:** terminate *every* statement with `;`.
* **Equality:** use strict operators `===` / `!==`; never `==` / `!=`.
* **Variables:**
  * `const` for bindings that never change,
  * `let` for re‑assignable bindings.
* **Loops:** use `for…of` for arrays/iterables; use `for…in` only for object keys when truly needed.
* **Arrow functions:** **always** wrap parameters in parentheses—even a single parameter.
* **Conditionals & loops:** wrap condition expressions in parentheses.
* No inline end‑of‑line comments; place comments on the **preceding line**.
  Keep comments concise; code should be self‑explanatory.
* Respect **.editorconfig** rules (indentation, line endings, etc.).
* Favor a **functional style** (pure functions, immutability) when practical.
* Before adding any external dependency, **ask the user** for approval.
* Always add comment before the line and not at the end of the line.
* In function or arrow function always add a new line before return statement.

## 3  Imports

```js
// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third‑party Dependencies
import express from "express";

// Import Internal Dependencies
import { doSomething } from "./lib/do‑something.js";
```

* Order **exactly** as shown: Node.js core → Third‑party → Internal.
* Precede each block with the indicated comment.
* Use **`node:`** prefix for Node.js core modules (e.g., `import fs from "node:fs"`).
* Use **`import`** syntax for all imports; never `require()`.

## 4  Naming

| Kind                              | Convention       | Example                 |
| --------------------------------- | ---------------- | ----------------------- |
| Classes, Interfaces, Type Aliases | **PascalCase**   | `class HttpServer {}`   |
| Variables, Functions, Methods     | **camelCase**    | `const fetchData = …`   |
| Private class fields & methods    | `#` prefix       | `#connectionPool`       |
| Exported constants                | **ALL\_CAPS**    | `export const API_URL`  |
| File‑local constants              | `k` + PascalCase | `const kTimeoutMs = 30` |

Place all constants directly **beneath the imports** under a `// CONSTANTS` comment.

## 5  Testing

* Use Node.js **core test runner** `node:test`.
* Use **`node:assert`** for assertions.
* Cover edge cases and error handling.
* **Never** modify production code solely to ease testing.
* For browser‑like APIs, mock the DOM with **`happy-dom`**.
* Always try to type variables such as mocks.

## 6  User Interaction (for Copilot / LLM)

* When the spec is ambiguous, **ask clarifying questions**.
* Reply in the **same language** as the prompt; generate **English** for code, comments, and docs.

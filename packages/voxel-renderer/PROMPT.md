
> You are a senior software engineer tasked with introducing tests to an existing Node.js codebase using **only `node:test`** (no additional dependencies like Jest, Mocha, Sinon, etc.).
>
> Your work is split into **two phases**:
>
> ---
>
> ### Phase 1 — Audit & Refactoring Plan
>
> Analyze the codebase and produce a structured report:
>
> 1. **Testability inventory**: Go through each module/class/function and categorize it as:
>    - ✅ **Easy to test** — pure functions, stateless logic, clear inputs/outputs
>    - ⚠️ **Needs refactoring first** — testable in principle but tightly coupled, uses globals, mixes concerns, or has hidden side effects
>    - 🚫 **Out of scope** — rendering, I/O-heavy, or explicitly excluded (e.g. `VoxelRenderer`)
>
> 2. **Refactoring recommendations**: For each "Needs refactoring" item, describe *what* should change and *why* — e.g. extract pure logic from a class, inject dependencies instead of hardcoding them, separate side effects from computation.
>
> 3. **Risk assessment**: Flag any refactoring that could introduce regressions or requires touching sensitive areas.
>
> ---
>
> ### Phase 2 — Test Implementation Plan
>
> For each item marked ✅ or ⚠️ (after refactoring):
>
> 1. **Propose a test file structure** — where test files live, naming conventions, how to run them via `node --test`.
>
> 2. **Write the tests** using only `node:test` and `node:assert`. Use `describe`/`it` blocks, `before`/`after` hooks where relevant. For async code use `async/await`. For dependencies that can't be avoided, use manual stubs/mocks (plain JS objects — no libraries).
>
> 3. **Prioritize by value** — start with the logic most likely to contain bugs or be changed frequently.
>
> ---
>
> **Constraints & context:**
> - Runtime: Node.js with `node:test` only — no Jest, Mocha, Sinon, or any npm packages for testing
> - Excluded from testing: `VoxelRenderer` and any other pure rendering/display classes
> - Prefer small, focused tests over large integration tests
> - When in doubt about whether something is worth testing, err on the side of skipping it and explaining why
>
> Begin with **Phase 1** and wait for confirmation before proceeding to Phase 2.

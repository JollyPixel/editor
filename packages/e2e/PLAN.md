# @jolly-pixel/e2e — PLAN

Starts after `PREREQUISITES.md` T1 to T3. T4 to T8 can land in parallel;
each one deletes its test-side helper when it does.

Every phase ends with the touched suites green (`pnpm --filter <suite>
test:e2e`, one run, not the whole matrix), `pnpm run typecheck` and
`pnpm run lint`.

## P1 — Package and core entry

- `packages/e2e`: `package.json` (private, `exports` `"."` and `"./editor"`
  on raw TS), `tsconfig.json` on the shared mixins, `src/`, `test/`,
  `README.md`.
- `defineE2EConfig`, `PORTS`, `baseUrl`, `socketUrl`, pointer helpers,
  locators, `recordSockets`.
- Unit tests (`node:test`): `defineE2EConfig` defaults, CI branches and
  overrides; `PORTS` has no duplicate. Locators and pointer helpers are
  covered by the suites that use them.
- Exit: the package typechecks and lints; nothing consumes it yet.

## P2 — ui and studio on the core entry

- ui: `playwright.config.ts` on `defineE2EConfig`, `constants.ts` removed,
  `support/pointer.ts` and `support/locators.ts` replaced by imports.
  `vite.config.ts` reads `PORTS.ui`.
- studio: config on `defineE2EConfig`, `PORTS.studio` in `vite.config.ts`.
  The spec uses `recordSockets` if it needs it; T8 is its own change.
- Exit: ui suite green, studio spec green.

## P3 — Editor entry, voxel editors

- `withCatalog`, `e2eFolder`, `openEditor`, `editorFixture`, `peer`,
  `editorHandle`.
- voxel-map and voxel-model: config, constants, fixture and panels
  locators replaced. Their `fixtures.ts` shrinks to `create(catalog)` with
  the seed documents. Collaboration specs use `peer`, offline specs use
  `recordSockets` and `openEditor` with `query: { offline: "" }`.
- Unit test: `openEditor` builds the expected URL from its options.
- Exit: both suites green locally. CI jobs stay disabled as today.

## P4 — pixel-art

- Config and constants on the shared entries; `openDemo` on `openEditor`
  with the demo's own query (`empty`, `runtime`, `import-policy`,
  `add-delay`).
- Decide the open question in the SPEC: keep per-worker seeded assets, or
  move to `editorFixture` and drop `resetCanvas` plus the seeding in
  `vite.config.ts`. Settle it before starting this phase.
- Exit: pixel-art suite green.

## P5 — CI matrix and docs

- One matrix job in `.github/workflows/node.js.yml` replacing the four,
  keeping the change filters, artifact upload and the two disabled entries.
- `README.md` of the package: the two entries, the dependency rule, how a
  new suite starts (config, fixture, first spec).
- `AGENTS.md` validation section: new e2e suites use `@jolly-pixel/e2e`.

## Later, out of this plan

Shared visual regression setup, an accessibility scan helper, a trace
viewer workflow. Only if a second suite needs one.

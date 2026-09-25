---
name: test-audit
description: "Invoke whenever writing, changing, reviewing, or sweeping tests in the JollyPixel workspaces. Authoring gate for new node:test, tstyche, and Playwright tests plus audit workflow for low-value, implementation-coupled, or duplicative tests and the test-only production seams they demand."
---

# Test Audit

Three modes, one value bar. Authoring mode gates every new or changed test at
write time. Audit mode runs focused sweeps of tests that re-assert source,
duplicate stronger proof, couple behavior to implementation, or keep test-only
production seams alive. Continue broad audits as separate coherent follow-up
changes; optimize for confidence, not deletion count. Campaign mode prunes one
whole workspace's test surface (every test file a package under `packages/**`
owns); before starting one, read [CAMPAIGN.md](CAMPAIGN.md).

## Test tiers

Every workspace keeps its tests under its own `test/` directory. The tier is
chosen by file suffix, and each suffix has one runner:

| Suffix | Runner | Owns |
|---|---|---|
| `*.spec.ts` (`*.test.ts` in arbor, resize-handle, three) | `node --test` with `node:assert/strict` | behavior, invariants, regressions |
| `*.tst.ts` | `tstyche` (`test-types` script) | inferred and generic type contracts |
| `*.e2e.ts` under `test/e2e/` | Playwright on `@jolly-pixel/e2e` (`test:e2e` script) | interaction, layout, real browser behavior |
| `*.gpu.ts` | dedicated script (`test-gpu`), outside the unit glob | GPU-only rendering probes |

`bench/` suites are measurements, not tests; never audit them against this bar.

Tier ownership rules:

- DOM-backed specs run on `happy-dom`, registered once in `test/setup.ts`
  through `node --import ./test/setup.ts`. happy-dom has no layout engine and
  no CSS cascade: geometry, focus order, scrolling, and computed styles belong
  in Playwright, not in a mocked unit spec.
- For `@jolly-pixel/ui` and the editors, unit-test pure logic extracted from
  components (reconciliation, clamping, parsing, size-from-delta) and cover
  interaction through the examples gallery or the editor e2e suite.
- Demo example pages (`packages/three/examples`,
  `packages/voxel-renderer/examples`, and similar) get no e2e harness.
- An e2e suite keeps only domain helpers; generic locators, ports, config, and
  editor fixtures live in `@jolly-pixel/e2e` (`packages/e2e/README.md`).
- Scheduling is tested with `t.mock.timers`, never with an injectable clock or
  timer seam in production code.

## Authoring gate

Before adding any test, answer four questions; a missing answer means do not
add it yet:

1. What observable behavior, invariant, or independent contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? Each contract has
   one primary test owner at the strongest boundary and the cheapest tier that
   can observe it; another tier needs its own distinct risk, such as a real
   browser layout or a network round trip the owner cannot reach. Prefer
   extending a table-driven case, the package's canonical scenario table, or a
   shared helper in `test/helpers/` or `test/fixtures/` over a near-duplicate
   test; consolidate duplicated setup in the same change.
4. Does it need a production seam (export, flag, wrapper, injection hook,
   `window` global) that no production caller needs? If yes, move the test to
   the real boundary instead.

Then check the test against every [junk pattern](#junk-patterns); a match fails
the gate unless the [retention bar](#retention-bar) names the contract it
independently guards. A test that would break under behavior-preserving
refactoring is asserting implementation, not behavior; rewrite it at the
owning boundary before landing it.

Bug regression tests must fail on the pre-fix code for the intended reason and
pass after the owner-boundary repair. A regression test that never demonstrably
failed proves the mock, not the fix. One regression at the owner boundary
covers the bug; do not replay the same scenario at every layer it crosses
(for example document, engine, view, and editor for one voxel edit).

Write new tests in the package's existing style: `describe`/`test` or
`describe`/`it` as the surrounding suite does, domain terms from the package's
`GLOSSARY.md`, and `.github/CODE_STYLE.md` for the code itself.

## Junk patterns

The shared checklist for every mode: the authoring gate rejects a new test that
matches one, and audits hunt for existing tests that do.

- assertion-free coverage probes, including "does not throw" smoke tests;
- self-comparisons and identity copiers;
- copied fixtures, inventories, manifests, or export lists;
- exact source, import, or string greps (import-graph guards such as
  `browser-compat.spec.ts` are the exception; see the retention bar);
- private predicate or call-shape tests duplicated at real boundaries;
- duplicate invocations of the same contract across `*.spec.ts` siblings or
  across the unit and e2e tiers;
- package-local replays of shared helpers already proven in their own
  workspace;
- tests whose only purpose is preserving test-only exports, globals, or
  wrappers;
- dead production code whose only callers are tests;
- expected values produced by the helper, serializer, or renderer under test;
- mocks that implement the asserted behavior, or one identical mock standing in
  for different APIs;
- layout, geometry, or computed-style assertions against happy-dom, whose
  stubbed rects and styles encode the answer;
- per-spec `new Window()` or `globalThis` patching instead of the package's
  `test/setup.ts`, and hand-rolled DOM fakes where happy-dom's real element
  works;
- fixtures that supply the acknowledgement, replay order, or callback ordering
  the owner should produce, or persistence asserted against a store the path
  never writes;
- network or sync tests that assert a local command was queued instead of
  replaying it on a second peer and checking convergence;
- tstyche assertions that restate a declared annotation instead of checking
  inference, narrowing, or a rejected call;
- negative controls that pass for an unrelated reason, such as a rejection from
  a different guard or an unknown id that makes every mask zero;
- loose identifier types (`string & {}` escape hatches) that let a fixture name
  a shape, kind, or block that does not exist, so the test passes vacuously;
- names or fixtures that promise more than the input exercises, such as an
  "undo restores the layer" test asserting only that history is not empty.

## Value bar

Tests justify their maintenance cost by protecting behavior, a credible
regression, or an independently meaningful contract. In an audit, an existing
test that must change for behavior-preserving source reorganization is suspect,
not automatically deletable; the authoring gate still rejects new ones.

Before judging a candidate, read the complete test and production owner, its
entry point, callers, callees, sibling implementations, overlapping tests
across tiers, CI routing, and relevant history. Read the root `AGENTS.md` and
the workspace `AGENTS.md` first, then the workspace's `GLOSSARY.md`,
`ARCHITECTURE.md`, and, for `@jolly-pixel/ui`, `docs/adr/`. When the test
claims dependency-backed behavior (Three.js, Lit, happy-dom, node:sqlite),
inspect the dependency source or types in `node_modules` directly.

CI routing lives in `.github/workflows/node.js.yml`: every unit, type, lint,
and typecheck script runs on every change, while e2e suites run through a
path-filtered matrix. The voxel-map and voxel-model e2e suites are currently
disabled there, so their Playwright tests are proven only locally; weigh that
before retiring a unit test whose only other proof is one of those suites.

## Discovery

Keep discovery read-only and report evidence before editing. When the request
names a workspace or folder, stay inside it; ask before reading sibling
workspaces for supporting evidence. For broad scope, run parallel discovery
lanes when available:

- core runtime: `engine`, `loop`, `runtime`, `controls`, `color`, `image`,
  `three`, `arbor`, `resize-handle`;
- renderers: `voxel-renderer`, `pixel-draw-renderer`;
- data and sync: `network`, `event-store`, `asset`, `asset-source`,
  `asset-server`, `assets/*`;
- UI and editors: `ui`, `editors/*`, `studio`, including their e2e suites;
- tooling: `e2e`, `bench`, plus a cross-cutting pattern sweep.

Useful sweeps: specs that construct `new Window()`, `stubRect` or
`getBoundingClientRect` overrides feeding assertions, `export` members whose
only importers sit under `test/`, and `*.e2e.ts` cases that re-check logic a
unit spec already owns.

Outside campaign mode, prefer a few high-confidence candidates over a large
speculative inventory. Hunt for the [junk patterns](#junk-patterns).

## Retention bar

Keep a test when it independently enforces a public package API (exports and
`docs/` API pages), wire protocol, event schema, persistence or replay,
serialization format, asset kind, security or path-safety, browser
compatibility, platform, default value, type-level, or architecture (ADR)
contract. Also keep:

- `browser-compat.spec.ts` import-graph guards: they are the cheapest proof
  that a browser entry point stays free of `node:` builtins and server-only
  modules;
- call ordering when order is observable behavior, such as event emission or
  history grouping;
- regressions with a credible failure mode;
- source inspection when it is the cheapest independent guard: it fails when
  the contract changes (the user-facing key, byte, or path) and survives an
  identifier-only refactor;
- a retained test that fails on the baseline: treat it as a possible product
  bug, reproduce it, and repair the owner rather than deleting it.

Static or slow is not a deletion reason. A test that resembles implementation
may still be the independent contract; prove otherwise before removing it.

## Candidate evidence

Record every field below before editing. A missing field means the candidate is
not ready for deletion:

- exact test name, file, and tier;
- what failure it can actually detect;
- non-test callers of the covered production or support seam;
- stronger remaining owner-boundary proof, or why no proof is needed;
- relevant history and the reason the test or seam exists;
- production or test-support deletion unlocked;
- whether the unlocked deletion touches a public export (docs and changeset
  needed) or a private workspace;
- risk and the focused validation command.

## Edit shape

Choose one coherent owner-boundary batch inside one workspace. Delete obsolete
test-only exports, globals, wrappers, and dead production paths instead of
preserving aliases. Move retained regressions to their canonical owners.
Consolidate repeated setup into `test/setup.ts`, `test/helpers/`, or
`test/fixtures/`, and repeated e2e plumbing into `@jolly-pixel/e2e`.

Prefer net-negative production LOC. Do not add replacement tests that restate
the same implementation, and do not convert uncertain candidates into cleanup
to increase deletion counts. Delete files one path at a time; never use a
recursive removal.

Removing a test-only export from a published workspace changes its public API:
update the Markdown API docs under that workspace's `docs/` and add a two or
three line changeset. Never add a changeset for a workspace with
`"private": true`, and none for test-only changes.

## Validation

Never edit source or tests while `node --test` or Playwright is running in the
checkout. Run commands with pnpm only.

1. Run the smallest owner and sibling specs with the flags of the package's
   `test-only` script, for example
   `pnpm --filter <package> exec node --import ./test/setup.ts --test test/<path>.spec.ts`
   (drop `--import` when the script has none; add `--test-name-pattern` to
   narrow further).
2. When `*.tst.ts` or public types changed, run
   `pnpm --filter <package> run test-types`.
3. For a deletion, compare the package's c8 coverage
   (`pnpm --filter <package> test`) with the baseline. Coverage parity is
   necessary, not sufficient: the keeper must still assert the contract.
4. When an e2e spec changed, run only that spec:
   `pnpm --filter <package> test:e2e test/e2e/<file>.e2e.ts`. Editors
   resolve `@jolly-pixel/ui` and `pixel-draw-renderer` from `dist/`, so rebuild
   those first when their source changed. A single timeout in a full
   voxel-map or voxel-model run must be rerun alone before it counts as a
   failure. Keep e2e reruns proportionate to the change.
5. Run `pnpm run typecheck`, `pnpm run lint`, and `git diff --check`.
6. Inspect `git diff --numstat`; report production and tooling separately from
   tests and test support.
7. After final audit edits, run `/code-review` on the diff.

Do not commit unless asked; when asked, follow the commit rules in
`AGENTS.md`.

## Handoff

Report:

- root cause and removed low-value categories;
- production owner simplifications;
- retained false positives and why they remain valuable;
- focused and full proof actually run, with e2e runs named separately;
- production versus test LOC;
- commit state and any changeset or docs update;
- named follow-ups.

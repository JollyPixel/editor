# Test-pruning campaign

Campaign mode prunes one workspace's whole test surface in one change: a
package such as `packages/voxel-renderer`, or one editor such as
`packages/editors/voxel-map`, across its unit, type, and e2e tiers. The value
bar, retention bar, candidate evidence, and validation in [SKILL.md](SKILL.md)
apply to every lane. This file adds the order of work and the lessons of past
campaigns. Each step ends on its completion criterion; do not start the next
step early.

## 1. Baseline

Record the workspace's test and support line counts, its c8 coverage summary,
and every test file's pass/fail state at a pinned commit, per tier:
`test-only`, `test-types` when present, and `test:e2e` when present. Keep
baseline failures in their own list; treat each as a possible product bug, not
a stale test. For voxel-map and voxel-model e2e, run a failing spec alone
before recording it: full runs time out at random under load.

Done when every in-scope test file has a recorded baseline result.

## 2. Lanes and inventory

Split the surface into **lanes** along production owner boundaries, not file
prefixes. Use the concern folders under `src/` (for voxel-renderer: blocks,
world, mesh, materials, tileset, serialization, commands, history, render),
plus the facade suites at the package root and the e2e suite as its own lane.
Include shared support (`test/setup.ts`, `test/helpers/`, `test/fixtures/`) as
a lane with a single owner.

Done when every test file and e2e spec the workspace owns belongs to exactly
one lane.

## 3. Read-only ledger per lane

Give each lane to its own read-only agent. The agent reads every assigned test
in full, including parameter tables. It also reads the production owners and
their entry points, callers, history, and CI routing. Each test declaration
goes into a written **ledger** with one mark. A table-driven loop is one
declaration unless its rows need different marks; then mark each row.

- `R`: retain, naming the contract and the bug it catches; a retained test that
  only moves to a better-named file stays `R` with the move noted;
- `F`: retain the contract but repair the assertion, such as a vacuous negative
  that passes when only one of several items is missing;
- `C`: consolidate, naming the owner that absorbs the assertion first: a sibling
  table case, the package's canonical scenario table, a stronger boundary
  suite, or the shared owner in another workspace;
- `D`: delete, naming the proof that remains, or why no contract exists.

Judge a test by its assertions, not its name. The voxel-renderer campaign
found a shape test that passed because `makeBlockDef(id, "slab")` named a
shape that does not exist: every mask was 0, and the loose `BlockShapeID` type
accepted it.

Done when every declaration in the lane has a mark and an evidence line.

## 4. Layer plan per lane

Treat the per-test ledger as input, not as the edit list. A second read-only
pass, starting from the ledger, looks for the redundant **layer**. In
voxel-renderer, the same layer-command facts were asserted at three to five
tiers (dispatch, world, engine, view, inspector) around one stronger
round-trip table that replays each command on a peer. Name the **keeper**
suite for each contract. Prefer the real boundary (a second peer, a real
happy-dom element, a real browser in e2e) over a mocked collaborator. Correct
any ledger errors this pass finds.

Done when each lane plan names its retired files, its keeper per contract, the
assertions to carry into keepers, and the test-only production seams unlocked.

## 5. Cutover

Edit lane by lane. Serialize changes to `test/setup.ts`, shared helpers, and
fixtures through one owner. With each lane, remove the test-only production
seams it unlocks: injection parameters, timer or clock hooks, getters, reset
exports, `window` globals, and indirection layers. Keep moved suites inside
the package's `test-only` glob and suffix; a probe that must stay out of the
unit run (such as `*.gpu.ts`) needs its own script. When an e2e suite moves or
gains a dependency, update its paths filter in
`.github/workflows/node.js.yml`. Put durable test-ownership rules in the
workspace's `AGENTS.md`, drawn from mistakes this campaign actually found.

Done when every lane plan is applied and each lane's keepers pass.

## 6. Preservation review

Before claiming completion, have independent reviewers compare deleted
coverage against the keepers, one reviewer per boundary group. They look for
contracts that lost their only proof. They also look for new assertions that
cannot fail, such as a rejection row the production code never reaches or a
type assertion that restates its own annotation. Compare the final c8 summary
with the baseline and explain every drop.

For each restored contract, make one deliberate **mutation** of the production
owner and confirm the keeper goes red. Then restore the source byte for byte.

Done when every reported gap is restored or rejected with source evidence, and
every restored contract has a caught mutation.

## 7. Product defects

A baseline failure that survives into a keeper is a bug report. Fix it at its
owner as a separate change, and prove it through the real user flow (the
editor or the examples gallery), with a **control** run that reverts the fix
and shows the old behavior. Record unrelated product discrepancies you find as
follow-ups instead of fixing them in the campaign.

Done when each repaired defect has a failing control and a passing candidate
on the same harness.

## 8. Reconcile and hand off

Campaigns outlive many `main` commits. Merge `main` rather than rebasing a
long campaign. When `main` modified a file the campaign deleted, keep the
deletion. Port the new contract into the keeper instead, and confirm every new
regression `main` added still has a home. Rerun the whole workspace suite
(`pnpm --filter <package> test`, plus `test:e2e` when present) on the merged
head, then `pnpm run typecheck` and `pnpm run lint`.

Expect review tooling to see a truncated file list on a diff this large.

Hand off with the [SKILL.md](SKILL.md) report, plus:

- baseline and final test/support line counts and coverage, with production
  counted separately;
- lanes, retired layers, and keepers;
- preservation gaps found and their mutations;
- product defects with control and candidate proof.

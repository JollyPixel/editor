# AGENTS.md

## Boundaries

Keep code that knows the studio or an editor (shell selectors, editor ready
signals, seeded assets) in the consuming harness, such as
`packages/studio/perf/`. This package only records, probes and reads.

## Gotchas

- Functions under `src/page/` run in the browser: Playwright sends their source
  text through `page.evaluate` or `addInitScript`. They cannot use imports,
  module constants or helpers; pass data as the argument and declare
  types inside the function file.
- Memory recording traces through Playwright's `Browser.startTracing`. A
  persistent context has no `Browser`, so it records CPU profiles and metrics
  but not memory.

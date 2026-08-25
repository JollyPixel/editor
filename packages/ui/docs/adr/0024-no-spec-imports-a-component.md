---
status: accepted
---

# No spec imports a component, so testable logic lives in plain modules

Components use decorators, matching `PixelDrawPanel` and `Vec3Input`, and a decorator is not erasable
syntax: `node --test` strips types rather than compiling, so importing a decorated module fails with
a `SyntaxError` before a single test runs. That is not a limitation to work around — it decides where
logic lives. Anything worth a unit test is a plain module the element calls: `deriveKey`,
`resolveOrder`, `clampToViewport`, `valueFromDelta`, `evaluate`, `formatNumber`, the flags mask
helpers, `isModified`.

Everything a component renders is covered by Playwright against the examples gallery, which is built
from this package's own components and is therefore also the standing proof that they compose.
happy-dom has no layout engine and no CSS cascade, so resize geometry, floating placement, drag-and-
drop hit testing and `light-dark()` resolution belong to that tier by necessity.

Tests address examples with one mechanism, a query parameter: `?example=controls/slider&chrome=off`
renders the example alone, extending what `editors/pixel-art` already does with `?empty`. Enumerating
the manifest gives one cheap test with disproportionate value — every example mounts and disposes
without throwing.

## Considered Options

- **Authoring components without decorators.** Would allow happy-dom component tests, but diverges
  from `PixelDrawPanel` and `Vec3Input` and re-litigates a settled test-tier split.
- **A real browser for the whole suite.** The tier that already times out spuriously in pixel-art,
  and `c8` wiring gets harder.
- **Screenshot snapshots in the end-to-end tier.** Baselines are per platform, development is Windows
  against Linux CI, and the tier is already the flaky one.
- **Hash routing alongside the query parameter.** Two mechanisms for one job: history handling, a
  precedence rule, and two code paths to test.
- **A fixed room name for the locking example.** Playwright runs four parallel workers against one
  dev server, so they would see each other's peers.

## Consequences

Any test that does import Lit needs a setup file registering `Document`, `ShadowRoot`,
`CSSStyleSheet` and `HTMLTemplateElement`, because `@lit/reactive-element/node/css-tag.js` reads
`Document.prototype` at import time. The existing `pixel-draw-renderer` setup does not.

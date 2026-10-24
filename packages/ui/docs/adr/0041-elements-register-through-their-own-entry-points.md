---
status: accepted
---

# Elements register through their own entry points, and the root registers none

`lit` is a peer dependency (`^3.3.0`) plus a pinned dev dependency, because two copies would break
class identity and re-register tags. `@jolly-pixel/network` is an optional peer, used only by the
`./network` adapter. `three` is not a dependency at all (ADR-0021).

Each custom element has an entry point named after its tag without `jolly-`:
`@jolly-pixel/ui/elements/dialog` registers `jolly-dialog`, exports `Dialog` and the dialog
helpers, and registers the elements the dialog renders. A module that renders a tag imports its
entry point. The root entry point exports the element types, the theme, the controllers and the
helpers, and reaches no element module: element classes appear there as types only. The facade
creates elements from values, so it moves to `./facade` with its types and imports every element it
can create. No other entry point registers an element: `./feedback` and `./icon`, which did, are
removed.

The root barrel used to export the elements themselves. Importing it registered all 54, and every
page shipped them whether it rendered them or not: a bundler keeps a `customElements.define` call
because it is a side effect. Code that a page loads lazily could not take its elements with it
either, since the barrel had already loaded them at start.

`package.json` still claims no `"sideEffects"`. Every element module is a side effect, and the
root needs no claim because it imports none of them.

A subpath is declared only once its code exists. `exports` targets are not validated at build time,
so an entry pointing at a path `tsc` never emits publishes a map whose subpath throws
`ERR_MODULE_NOT_FOUND` on import, with nothing in the build to catch it. `./elements/*` is the one
folder wildcard, and `scripts/exports` checks that its source folder exists.

## Considered Options

- **Keep the registering barrel and add a `sideEffects` list.** Measured on 17 October 2026:
  voxel-map went from 626 to 624 KB of brotli and the shell did not move, because the barrel still
  reaches every element.
- **Entry points per group (`./math`, `./monitors`).** Fewer imports, but a page that renders one
  vector field pays for `jolly-transform` too, and the groups drift as pages change.
- **A runtime autoloader that imports a definition when an unknown tag appears.** An element
  rendered before its definition keeps own properties that shadow its accessors, the hazard
  `LazyTemplate` exists for, and every shadow root would need observing.

## Consequences

A forgotten import leaves an unknown element that renders nothing, and only on pages where no
other module registered it. `test/elements/registration.spec.ts` bundles every entry point. It
checks that only the element entries and the facade register anything, that each element entry
registers every tag it renders, and that the facade registers every tag it names. The repository
lint rule `@jolly-pixel/import-rendered-elements` requires the import in any module whose `html`
template or `createElement` call names a ui tag. It cannot read a page's HTML, so the studio
bundle test checks that each page registers at start every element its HTML renders.

Small element modules split into more chunks than one barrel did, and each chunk compresses on its
own. A build with several pages should keep the ui those pages load at start in one chunk, as the
studio build does.

`JollyField`, `ScrubController` and the extracted pure helpers stay out of the root entry point.
The package publishes with `access: public`, so promoting one later is additive while withdrawing
one is breaking.

A single copy of Lit across the workspace is something the repository checks rather than
guarantees: `pnpm why lit` resolving to one version is the check. `saveExact` also means pnpm will
not write the `^3.3.0` peer range itself; it is hand-edited.

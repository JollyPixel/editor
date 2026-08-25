---
status: accepted
---

# Lit is a peer dependency and the barrel is never side-effect-free

`lit` is a peer dependency (`^3.3.0`) plus a pinned dev dependency, because two copies would break
class identity and re-register tags. `@jolly-pixel/network` is an optional peer, used only by the
`./network` adapter. `three` is not a dependency at all (ADR-0021).

The root barrel exports the elements themselves, so importing it registers every custom element as a
side effect, and three editors consume the package wholesale. `package.json` must therefore never
claim `"sideEffects": false`: a bundler taking that at its word drops the `customElements.define`
calls and every tag renders as an unknown element.

Each subpath is declared in the phase that creates its code, never earlier. `exports` targets are not
validated at build time, so an entry pointing at a path `tsc` never emits publishes a map whose
subpath throws `ERR_MODULE_NOT_FOUND` on import, with nothing in the build to catch it.

## Consequences

`JollyField`, `ScrubController` and the extracted pure helpers stay out of the barrel. The package
publishes with `access: public`, so promoting one later is additive while withdrawing one is
breaking.

Because `.npmrc` sets `package-lock=false`, a single hoisted copy of Lit is not something the
repository can guarantee, only something it can check: `npm ls lit` returning one deduped entry is a
completion criterion, not a claim. `save-exact=true` also means npm will not write the `^3.3.0` peer
range itself; it is hand-edited.

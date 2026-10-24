---
"@jolly-pixel/ui": major
"@jolly-pixel/console": minor
"@jolly-pixel/lantern": minor
"@jolly-pixel/runtime": patch
---

`ui` elements now register from `@jolly-pixel/ui/elements/<name>` (class and dialog helpers included) and the facade, with its types, moved to `@jolly-pixel/ui/facade`; `./feedback` and `./icon` are removed, and the root entry registers nothing and exports element classes as types only.
Add `LazyTemplate` to `ui`, and let `jolly-console` (`editScript`) and `jolly-lantern` (`TourRun.shown`) be created late, so pages load these elements only when first needed.

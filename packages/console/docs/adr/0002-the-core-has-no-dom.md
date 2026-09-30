---
status: accepted
---

# The root entry has no DOM, and the element is a second entry

`@jolly-pixel/console` holds the registry, the line parser, the input classifier, the search
scorer, the history and the scrollback, with no DOM and no Lit. `@jolly-pixel/console/element`
holds `jolly-console`, with `lit` and `@jolly-pixel/ui` as peers.

Every rule of the grammar, the search ranking and the registry is tested under `node --test`
without a browser, following
[ui ADR-0024](../../../ui/docs/adr/0024-no-spec-imports-a-component.md). A package that only
registers commands depends on the root entry alone: voxel-map's brush feature and pixel-art's
keybind feature import types and `registerConsoleFeatures` from it and never load the element.

## Consequences

The root entry exports `CommandConsole`, the registration types, the registration errors and the
feature helpers. The parser, search and completion stay internal; the element imports them by
relative path inside the package.

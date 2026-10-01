---
status: accepted
---

# One Lit element per panel, pure decisions in value objects

The shell is Lit, like the editors. `<jolly-studio>` owns the layout, the tabs and the routing;
`<asset-browser>` owns the tree, its state and the catalog commands. Each later panel gets its own
folder under `src/shell/`.

Decisions that need no DOM live in value objects (`AssetPath`, `AssetTreeModel`, `AssetKindSet`,
`SavedTabs`) and controllers (`EditorTabs`, `StudioSession`), which carry the unit tests. Element
flows are proven by the Playwright suite.

This replaced the first cut's plain DOM `StudioShell`, which wired the catalog, the tree and the
tabs by hand and stopped fitting once the tree gained rename, delete and drag.

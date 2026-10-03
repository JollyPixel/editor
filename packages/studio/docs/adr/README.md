# Architecture Decision Records

Decisions behind `@jolly-pixel/studio` that are hard to reverse or surprising without context.
Structure is described in [ARCHITECTURE.md](../../ARCHITECTURE.md), open work in
[ROADMAP.md](../../ROADMAP.md).

| # | Decision |
|---|---|
| [0001](./0001-editors-are-built-pages-in-iframes.md) | Editors are built pages in same-origin iframes |
| [0002](./0002-the-shell-consumes-data-only.md) | The shell consumes data only |
| [0003](./0003-the-shell-answers-a-ready-message.md) | The shell answers a ready message with the launch |
| [0004](./0004-the-shell-channel-is-one-way.md) | The shell channel is one-way and exists only after a parent launch |
| [0005](./0005-four-editor-tabs.md) | Four editor tabs, frames loaded on first focus |
| [0006](./0006-open-tabs-persist-per-browser.md) | Open tabs persist per browser |
| [0007](./0007-page-urls-are-relative-to-the-shell.md) | Editor page URLs are relative to the shell, back-end URLs are origin-absolute |
| [0008](./0008-pixel-art-page-edits-pixelart-only.md) | The pixel-art page edits `pixelart` assets only |
| [0009](./0009-editor-entries-never-await-their-mount.md) | Editor entries never top-level-await their mount |
| [0010](./0010-folders-live-in-the-asset-source.md) | Folders live in the asset source, and partial folder commands are not rolled back |
| [0011](./0011-one-lit-element-per-panel.md) | One Lit element per panel, pure decisions in value objects |
| [0012](./0012-one-project-per-studio.md) | One project per studio, seeded without overwriting |
| [0013](./0013-companions-are-derived-from-names-and-edges.md) | Companions are derived from names and dependency edges |
| [0014](./0014-the-asset-browser-lives-on-home.md) | The asset browser lives on the Home tab |
| [0015](./0015-the-studio-console-takes-precedence.md) | The studio console takes precedence over editor consoles |
| [0016](./0016-the-project-file-lists-editors-and-kinds.md) | The project file lists editors and kinds |
| [0017](./0017-project-packages-are-trusted-code.md) | Project packages are trusted code |

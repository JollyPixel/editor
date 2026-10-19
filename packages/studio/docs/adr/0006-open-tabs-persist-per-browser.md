---
status: accepted
---

# Open tabs persist per browser

The shell saves the open tabs, in strip order, and the active one under `studio:tabs` in
`localStorage`, like `studio:asset-kind` and the `studio:home-layout` dock layout. A tab open, close,
move or focus writes it.

On boot, once the catalog has its records, the shell reopens the saved tabs in order and focuses
the saved active tab. Only that tab loads its editor ([ADR-0005](./0005-four-editor-tabs.md)).
Deleted assets and kinds without an editor are skipped, and restoring stops at the cap, so a
restore never asks to evict. A saved value that does not parse restores nothing.

## Considered Options

- **The account's preferences.** Tabs are browser state
  ([ADR-0023](./0023-preferences-follow-the-account.md)): another browser of the same account
  opens on its own tabs.
- **Restoring every frame.** A reload would boot up to four editors at once.

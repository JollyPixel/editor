---
status: accepted
---

# Editors read their preferences from the shell

An editor page in a studio tab has no account of its own to load preferences with
([ADR-0023](./0023-preferences-follow-the-account.md)), so the shell hands them over:

1. Each editor package names a module in its manifest, `jollypixel.editor.preferences`. Its
   default export is the list of `definePreferences` scopes the editor declares, and its
   `shared` export the scopes it reads from another editor. The server `import()`s the module at
   startup, validates writes against the scopes, and the project manifest carries their
   descriptors to the shell, which renders the Settings pages from them.
2. `jolly-launch` carries the overrides of every scope the shell holds.
3. A change made in the frame, from a view menu or the console, posts an `update-preferences`
   shell command with the scope and the values it set. The shell checks the patch against the
   scope, stores it on the account and pushes the scope's new overrides to every frame as
   `jolly-preferences`.
4. A change made in Settings, or in another browser tab, reaches the frames the same way.

An editor opened outside the studio keeps the same scopes in `localStorage`.

## Considered Options

- **A `preferences.json` written by the editor build.** The studio build compiles in-repo editor
  pages from source and never reads their `dist/`, so the file would require every editor to be
  built first. A module the server imports has one source and gives the editor typed values.
- **Each frame fetching `/api/preferences/`.** Every frame would load them again and need its own
  sync with the others; the shell already holds them.
- **Only the editor's scopes in the launch.** A frame does not know which editor it hosts, and the
  overrides are the user's own and small, so the shell sends them all.

## Consequences

- An editor's preferences module must load in Node.js: it imports only
  `@jolly-pixel/preferences`, `@jolly-pixel/editor.host/preferences` and other
  modules that are just as plain.
- A scope shared by several editors, such as the pixel-art panel shortcuts, is declared once, by
  the editor that owns it, and listed under `shared` by the others. Settings shows it on its
  owner's page, or on the first editor sharing it when the owner is not installed. Two different
  declarations of one scope name stop the server at startup.
- The shell answers no command: `jolly-preferences` goes to every frame, the sender included,
  which ignores overrides it already has.

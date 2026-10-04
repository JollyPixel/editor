# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## 1. Identity in the launch message

The shell already prompts once and editor frames read the stored name from
`sessionStorage`, but each frame mints its own peer id. Carrying the identity
in `jolly-launch` gives one user one presence color across tabs.

## 2. Authentication

The shell logs in once, the launch message carries a token, and the network
`AuthenticationProvider` checks it on upgrade. Editors never learn how the
identity was obtained.

## 3. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`.

## 4. Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

## 5. In-process editors

Mount editors in the shell's document instead of iframes. Waits for the
`EditorDefinition` revisit in the
[editor host roadmap](../editors/host/ROADMAP.md): `mount` takes a container,
not `document`.

## Performance

Tracked in [PERFORMANCE.md](./PERFORMANCE.md), with how to measure.

## Waiting for a trigger

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K,
  but no editor calls `context.shell` since the voxel-map Paint action was
  dropped. Title and dirty state are the expected next commands; add them
  when an editor needs the shell to show either.

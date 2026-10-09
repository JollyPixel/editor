# @jolly-pixel/studio — ROADMAP

Open work, in the order it should land. Decisions already taken are in the
[ADRs](./docs/adr/README.md). Each step ends with
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck` and
`pnpm run lint` green.

## 1. Preferences and settings pane

A per-user store the shell owns, reached from the header toolbar. The open
tabs, the dock layout and the kind filter move there from `localStorage`. It
becomes the home of the account: the avatar upload moves there from the
`AccountBadge` menu.

## 2. Share links

A read-only link to one asset for people without an account.

- **Route.** `/view/<token>` serves the asset's standalone editor page with
  the launch injected server-side, through the asset-server Vite plugin's
  `transformIndexHtml`. Guests never get the shell or the catalog room, so
  the project tree stays hidden. `QueryLaunchSource` stays for dev.
- **Scope.** The asset and its dependency closure, walked over catalog edges
  at each join. A texture linked after the link was made is readable; one
  unlinked is not.
- **Credential.** The upgrade accepts the token in place of the session
  cookie, for covered rooms only, with spectator rights. Links never grant
  write.
- **Storage.** A `share_links (token_hash, asset_id, created_by, expires_at)`
  table in `accounts.db`. The token is shown once at creation.
- **Lifetime.** The creator picks 1 day, 7 days, 30 days or never. Revoking
  disconnects guests already watching.
- **Rights.** Creating a link is a `studio.$share` key in `access.roles`, so
  each project decides who shares. Creators revoke their own links, admins
  any.
- **Presence.** Guests show as "Guest" with their default avatar and a "via
  link" badge.

## Waiting for a trigger

- **Session renewal.** A socket that rejoins without a reload once its
  session is renewed. Editor frames do not hear when their own socket is
  refused.

- **Shell commands from editors.** The host posts `toggle-console` on Ctrl+K,
  but no editor calls `context.shell` since the voxel-map Paint action was
  dropped. Title and dirty state are the expected next commands; add them
  when an editor needs the shell to show either.

## Long-term goals

### Runtime tab

Another page in another iframe that plays the project. No editor contract
involved; its action goes in the header toolbar.

### In-process editors

Mount editors in the shell's document instead of iframes. The
`EditorDefinition` contract assumes one editor per document:

- `mountStandalone` owns page-wide state: `data-editor-state` on `<html>`,
  the `jollyEditor` debug global and `LastOpenedLaunchSource`.
- `EditorContext` carries no container, so editors mount into the page's own
  DOM.
- Embedded panels (voxel-map's `TextureEditor`, voxel-model's texture panel)
  take an `AssetLeases` lease, not a context.

A starting shape: a base context every mounted piece gets,
`{ container, assets, shell, logger }`, that a full editor extends with
`launch` and `session`. A panel is then a smaller definition on the same
contract. `ShellChannel` wraps a `ShellPort`, so an in-process port is
trivial.

To settle in a design pass first:

- One `EditorSession` and WebSocket for every editor, or one each.
- CSS isolation: a shadow root per editor, or stay in iframes.
- One `Runtime` per editor and its WebGL context cost.
- `Keyboard.addGuard` and the input layers assume one editor per page.
- Page-wide state moves to the shell or becomes per editor.

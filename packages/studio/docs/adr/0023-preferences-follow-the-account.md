---
status: accepted
---

# Preferences follow the account

What a user configures falls into three tiers, kept in three places:

- **Project settings** concern everyone who opens the project: `project.json`, on the server.
- **Preferences** concern one account: theme, density, prefetching editors and, later, editor
  options, shortcuts and the camera. They live in that project's `.jollypixel/accounts.db`, in a
  `preferences` table keyed by account and scope, so they follow the account to any browser.
- **Browser state** concerns one browser: the open tabs, the dock layouts, the expanded folders,
  the kind filter. It stays in `localStorage` and never shows in Settings.

A preference scope is declared once with `definePreferences` from
`@jolly-pixel/preferences`: each field is a boolean, an enum, a number range or a key
chord, with a label and a default. The server builds its validation from the same descriptors, so
a `PUT /api/preferences/<scope>` with an unknown field or a refused value fails with a 400, and a
read drops stored fields the descriptors no longer declare. Only overrides are stored: assigning a
field its default removes it.

The shell loads the overrides right after `me`. A change goes to the server at once, one request
per scope in flight and only the latest overrides after it, and to the other studio tabs of the
browser through a `BroadcastChannel`. The offline studio keeps the same overrides in
`localStorage`, under `jolly-pixel:preferences:<scope>`.

The theme would flash on every load while the preferences are fetched, so the shell keeps the last
appearance it applied under `studio:appearance` and paints with it first. That key is a copy the
account overwrites, never read back into the preferences.

## Considered Options

- **Everything in `localStorage`.** What the studio did: each browser started from the defaults,
  and two users of one browser shared their choices.
- **One store across projects.** Each project has its own accounts, so there is no account to hang
  it on. Exporting preferences to a file waits for a need.
- **Moving the existing `localStorage` values.** They are few and easy to set again; no migration
  was written.

## Consequences

- An editor reads its preferences from the shell, not from `localStorage`, once the launch carries
  them.
- Signing in from a new browser restores the preferences but not the tabs or the layouts.

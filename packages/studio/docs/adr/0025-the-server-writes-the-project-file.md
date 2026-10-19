---
status: accepted
---

# The server writes the project file and applies it live

Settings › Project edits the `kinds` and `access` sections of `.jollypixel/project.json`. The file
stays the source of truth ([ADR-0016](./0016-the-project-file-lists-editors-and-kinds.md)), and the
studio server is the only writer while it runs:

1. `PUT /api/project/settings/<section>` checks the section with the schemas the server reads it
   with at startup: `StudioAccess` for `access`, each kind package's `optionsSchema` for `kinds`.
   Every check runs before the file is written, so a refused save changes nothing.
2. `ProjectFile.replace` writes the whole file to a temporary file and renames it over the old
   one, then holds the new document. The dev watcher compares the file with that document, so it
   skips the server's own writes and still restarts on a hand edit.
3. The change applies without a restart. New kind options rebuild that package's handlers, which
   new assets and the snapshot timers use. New access rules swap the network server's rights
   table, the account roles and the access requests toggle, then revoke the sessions of every
   account whose role's rules changed: they reconnect, and a room they lost refuses them.

`studio.$settings` and `studio.$audit` count only when a role names them, so `*` and `studio.*`
grant neither and only admins see Project by default. Access is admin only by a fixed rule, like
role changes in the accounts.

## Considered Options

- **Settings in a database, `project.json` read once.** Two sources for one setting, and a project
  copied without its `.jollypixel/` state would lose them.
- **Re-checking a live session in place.** Network would need a new envelope to resend a room's
  rights and a way to remove one member from a room. Revoking reuses the reconnect path every
  client already has.
- **Rights through wildcards.** `"*": "write"` on every default role would hand settings to every
  member.

## Consequences

- Comments and hand-picked key order in `project.json` are lost on the first save.
- Adding or removing a kind package or an editor still means editing the file, since it loads code.
- Deleting a role an account holds, or the role new accounts get, is refused. A role is renamed by
  adding one and moving its members.
- The offline studio keeps the kind options it was built with.

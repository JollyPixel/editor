# Accounts

The online studio asks everyone to sign in. An account belongs to the server, and its membership to each project: one sign-in covers every project of the server. The first account registered becomes the server's owner and an admin of every project; later ones join the project they registered from. Accounts live in `accounts.db` in the server's state folder (the project's `.jollypixel/` when the server hosts one project), which stays out of Git. Signing in needs HTTPS or `localhost`.

## Roles

Roles are set in the `access` section of `.jollypixel/project.json`. Without it, the defaults below apply. `admin` is built in and cannot be declared.

```json
"access": {
  "defaultRole": "spectator",
  "roles": {
    "member": { "*": "write" },
    "spectator": {
      "*.$join": "write",
      "*.$presence": "write",
      "*": "read"
    }
  },
  "join": "request"
}
```

`join` decides what happens when an account registers from the project, or enters it signed in from another one:

- `request` (the default): an access request, which an admin approves with a role or denies.
- `open`: the account joins at once with `defaultRole`.
- `invite`: refused. An admin adds members by username with `/users invite`.

A role sees Settings › Project only when it names `"studio.$settings"`, and the audit only when it names `"studio.$audit"`: `*` grants neither. `"write"` on `studio.$settings` also lets it change the kind options and the kind filter; the Access section stays admin only.

## Master password

Set `JOLLY_MASTER_PASSWORD` so that a stranger who reaches the server first cannot claim the owner account: the first registration must give it, and later ones never need it. To change the password, restart with a new value. Without the variable, registration is open and the server warns at startup.

## Joining another project

An account signed in on one project of the server that opens another one it does not belong to gets a "Join this project" dialog instead of the sign-in form. Joining follows the project's `join` mode. "Use another account" signs out.

## Managing accounts

The Users pane on Home lists every account under its role and shows who is online. An admin manages them from the same pane: a role change or a removal from the project from an account's context menu, or with the `/users` console commands. A removed account keeps its other projects. Only the owner deletes an account, with "Delete account" or `/users delete`, which removes it from every project with its sessions, share links and agent tokens. Admins also see pending access requests in their own group, and approve one with a role or deny it, which frees the username. A role change reconnects the user's open tabs under the new role.

Settings › Project › Access edits the roles themselves, and Settings › Project › General the default role and the joining mode; both save to `project.json` without a restart. General also lists the pending requests: approving or denying one there acts at once, outside the save bar.

A crown marks the server's owner. No admin can change the owner's role or remove it. The owner can make another account the owner from its context menu or with `/users transfer`; that account owns the server and every project, and the previous owner stays an admin of every project.

## Agent tokens

An agent token lets an AI agent running on your machine (Claude Code, Codex, Cursor…) join the studio as a peer through `@jolly-pixel/golem`. Create one in Settings › You › Access keys. The page shows the token once, inside a `claude mcp add` line that points at the studio's URL; copy it before closing the panel, because only a digest is stored. Replace the line's `<checkout>` with the path of your clone of this repository. To swap the token of an agent you already set up, copy the token alone with "Copy the token". "Change avatar…" on a token's row gives its agent a picture; connected agents switch to it at once.

An agent has your current role and never more. It shows in the peer lists under the token's name with a "via golem" badge, and the audit names its edits after the token and you, "Golem (Alice)". Revoking the token disconnects it for good. A role change or a removal of your account reconnects or refuses your agents too; signing out does not. Tokens never expire.

### Golem chat

Click the chat button at the top right, next to your avatar, to open or close the golem chat beside the editors. In the console, `/golem` opens it too, and `/golem <message>` opens it and sends the message. The pane lists the connected agents with what they are doing and in which asset, and the conversation, which every signed-in person and agent shares. Each message shows its author's current avatar while they are connected. Enter sends, Shift+Enter starts a new line. A role that only reads, such as `spectator`, sees the chat but cannot write in it, and share-link guests never see it.

When an agent writes while the pane is closed, a notification shows its message. The studio keeps the last 200 messages in memory: restarting it empties the chat.

## Audit

Settings › Audit lists what happened in the project, newest first: edits, created, renamed, restored and deleted assets, folders, tags, settings changes, and, for admins, account activity. The server writes each row as it happens, so the audit starts the day the project runs this version; earlier edits are not listed.

One person's edits to one asset less than 5 minutes apart make one row. The row keeps the asset's version before the first edit and after the last one, opened read-only with Open before and Open after, and says what changed for kinds that describe it, such as "12 pixels changed" or "blocks 4 placed, 1 removed". Edits by two people at the same time share these versions.

Export CSV downloads every row the filters match. Settings › General › Audit retention deletes rows, and separately the versions they open, past an age in days; 0 keeps them forever. By default rows stay and versions go after 30 days. Tags people named are never deleted.

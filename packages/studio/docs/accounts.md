# Accounts

The online studio asks everyone to sign in. The first account registered on a project becomes its owner and an admin; later ones get the project's default role. Accounts live in `.jollypixel/accounts.db`, which stays out of Git. Signing in needs HTTPS or `localhost`.

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
  }
}
```

A role sees Settings › Project only when it names `"studio.$settings"`, and the audit only when it names `"studio.$audit"`: `*` grants neither. `"write"` on `studio.$settings` also lets it change the kind options and the kind filter; the Access section stays admin only.

## Master password

Set `JOLLY_MASTER_PASSWORD` so that a stranger who reaches the server first cannot claim the admin account: the first registration must give it. When `access.accessRequests` is `true`, a later registration without it becomes an access request: the account cannot sign in until an admin approves it, and the studio refuses to start with that setting but no password. To change the password, restart with a new value. Without the variable, registration is open and the server warns at startup.

## Managing accounts

The Users pane on Home lists every account under its role and shows who is online. An admin manages them from the same pane: a role change or a removal from an account's context menu, or with the `/users` console commands. Admins also see pending access requests in their own group, and approve one with a role or deny it, which frees the username. A role change reconnects the user's open tabs under the new role.

Settings › Project › Access edits the roles themselves, and Settings › Project › General the default role and access requests; both save to `project.json` without a restart. Turning access requests on still needs `JOLLY_MASTER_PASSWORD`. General also lists the pending requests: approving or denying one there acts at once, outside the save bar.

A crown marks the owner. No admin can change the owner's role or remove it. The owner can make another account the owner from its context menu or with `/users transfer`; that account becomes an admin, and the previous owner stays one.

## Agent tokens

An agent token lets an AI agent running on your machine (Claude Code, Codex, Cursor…) join the studio as a peer through `@jolly-pixel/golem`. Create one in Settings › You › Access keys. The page shows the token once, inside a `claude mcp add` line that points at the studio's URL; copy it before closing the panel, because only a digest is stored. Replace the line's `<checkout>` with the path of your clone of this repository.

An agent has your current role and never more. It shows in the peer lists under the token's name with a "via golem" badge, and the audit names its edits after the token and you, "Golem (Alice)". Revoking the token disconnects it for good. A role change or a removal of your account reconnects or refuses your agents too; signing out does not. Tokens never expire.

### Golem chat

Type `/golem` in the console to open the golem chat beside the editors, or `/golem <message>` to open it and send the message. The pane lists the connected agents with what they are doing and in which asset, and the conversation, which every signed-in person and agent shares. Enter sends, Shift+Enter starts a new line. A role that only reads, such as `spectator`, sees the chat but cannot write in it, and share-link guests never see it.

When an agent writes while the pane is closed, a notification shows its message. The studio keeps the last 200 messages in memory: restarting it empties the chat.

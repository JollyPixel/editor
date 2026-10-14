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

## Master password

Set `JOLLY_MASTER_PASSWORD` so that a stranger who reaches the server first cannot claim the admin account: the first registration must give it. When `access.accessRequests` is `true`, a later registration without it becomes an access request: the account cannot sign in until an admin approves it, and the studio refuses to start with that setting but no password. To change the password, restart with a new value. Without the variable, registration is open and the server warns at startup.

## Managing accounts

The Users pane on Home lists every account under its role and shows who is online. An admin changes a role or removes an account from its context menu, or with the `/users` console commands. Admins also see pending access requests in their own group, and approve one with a role or deny it, which frees the username. A role change applies on the user's next connection.

A crown marks the owner. No admin can change the owner's role or remove it. The owner can make another account the owner from its context menu or with `/users transfer`; that account becomes an admin, and the previous owner stays one.

---
"@jolly-pixel/accounts": minor
"@jolly-pixel/ui": minor
---

Accounts have an owner: the first account, which no admin can demote or remove, and which hands ownership to another account with `AccountsRoster.transferOwnership`. `Account.owner` flags it, and the last-admin rule is gone.
`AccountsDatabase` replaces `AccountStore`: `new Accounts()` takes `{ database, roles }`, and `StoredAccount` is no longer exported.
`TreeBadge.icon` draws a badge as an icon in its colour instead of a dot.

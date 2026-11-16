---
"@jolly-pixel/accounts": minor
---

Sign-in is server-wide: `AccountsRealm.admit` tells whether a signed-in account may enter a realm, `join` enters it, and `POST join` serves it.
Admins add members with `accounts:invite`, the owner deletes accounts with `accounts:delete`, `Accounts.memberships` lists an account's realms, and `credentialsBody` builds a login body.

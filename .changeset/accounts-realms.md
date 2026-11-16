---
"@jolly-pixel/accounts": major
---

Split server-wide identities (`Accounts`) from per-project membership (`accounts.realm(id, { roles, join })`, an `AccountsRealm`).
Roles, access requests, share links and agent tokens now belong to a realm; the first account owns the server and is admin everywhere.

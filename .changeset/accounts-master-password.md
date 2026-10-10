---
"@jolly-pixel/accounts": minor
---

Add the `masterPassword` option: the first registration must give the secret, and with `accessRequests` a later one without it resolves `{ status: "pending" }` and waits for an admin to approve or deny it from the roster.
`Accounts` serves no HTTP: the host serves `ACCOUNTS_ROUTES` with `register`, `login`, `signOut`, `signedIn` and the avatar methods (`handler`, `path`, `proxyHops` and the `method-not-allowed` and `length-required` codes are gone), and `SessionCookie({ name, ttlMs })` owns the session lifetime.
Domain errors extend `AccountsError` with a `code` and no HTTP `status`; `AccountsRequestError` no longer extends it and carries an `AccountsFailureCode`.

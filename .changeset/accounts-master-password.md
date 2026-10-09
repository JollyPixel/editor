---
"@jolly-pixel/accounts": minor
---

Add the `masterPassword` option: the first registration, or every one when `required` is set, must give the secret.
`Accounts` now exposes only what a host plugs in (`handler`, `extension`, `authenticate`, `watchRevocations`, `roles`, `cookie`), `AccountStore` enforces every role rule, and `SessionCookie({ name, ttlMs })` owns the session lifetime.
Domain errors extend `AccountsError` with a `code` and no HTTP `status`; `AccountsRequestError` no longer extends it and carries an `AccountsFailureCode`.

---
"@jolly-pixel/accounts": minor
---

Add the `masterPassword` option: the first registration, or every one when `required` is set, must give the secret.
`register` takes `RegisterOptions` with the master password, and `AccountStore.unclaimed` tells whether the next account becomes admin.

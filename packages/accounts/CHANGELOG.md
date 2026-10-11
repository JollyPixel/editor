# @jolly-pixel/accounts

## 1.1.0

### Minor Changes

- [#943](https://github.com/JollyPixel/editor/pull/943) [`c28ae6b`](https://github.com/JollyPixel/editor/commit/c28ae6be469f6c67136d3106f73202656c4fe435) Thanks [@fraxken](https://github.com/fraxken)! - Add the `masterPassword` option: the first registration must give the secret, and with `accessRequests` a later one without it resolves `{ status: "pending" }` and waits for an admin to approve or deny it from the roster.
  `Accounts` serves no HTTP: the host serves `ACCOUNTS_ROUTES` with `register`, `login`, `signOut`, `signedIn` and the avatar methods (`handler`, `path`, `proxyHops` and the `method-not-allowed` and `length-required` codes are gone), and `SessionCookie({ name, ttlMs })` owns the session lifetime.
  Domain errors extend `AccountsError` with a `code` and no HTTP `status`; `AccountsRequestError` no longer extends it and carries an `AccountsFailureCode`.

- [#945](https://github.com/JollyPixel/editor/pull/945) [`c0643f9`](https://github.com/JollyPixel/editor/commit/c0643f9978941d93eb2fee7ca4d524fc20e23339) Thanks [@fraxken](https://github.com/fraxken)! - Accounts have an owner: the first account, which no admin can demote or remove, and which hands ownership to another account with `AccountsRoster.transferOwnership`. `Account.owner` flags it, and the last-admin rule is gone.
  `AccountsDatabase` replaces `AccountStore`: `new Accounts()` takes `{ database, roles }`, and `StoredAccount` is no longer exported.
  `TreeBadge.icon` draws a badge as an icon in its colour instead of a dot.

- [#945](https://github.com/JollyPixel/editor/pull/945) [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875) Thanks [@fraxken](https://github.com/fraxken)! - Profiles update live: `Server.updateProfile` (fed by `AuthenticationProvider.watchProfiles`) sends `peer-profile` to every room member, and `Room.profile` holds the profile the server admitted for this client.
  `Accounts.watchProfiles` reports a new avatar, and `PeerRoster` follows both, so peers and the local row show it without reconnecting.

### Patch Changes

- Updated dependencies [[`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f), [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`40e16a4`](https://github.com/JollyPixel/editor/commit/40e16a4ae92fdb94931b59e9ba80af52330b1bc4), [`27cff63`](https://github.com/JollyPixel/editor/commit/27cff63c507ae72b62c0299999590c839f2ac492), [`28dae7b`](https://github.com/JollyPixel/editor/commit/28dae7b8ef17f600128ba02cfe33436afadf1c92), [`5fbedf2`](https://github.com/JollyPixel/editor/commit/5fbedf27124e3deb38992f3b70592b9536d9223c), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681)]:
  - @jolly-pixel/network@6.0.0

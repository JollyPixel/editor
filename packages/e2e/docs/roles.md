# Roles

Gives each browser context its own network role, so a suite can test what a
role may do and what happens when the role changes mid-session. An editor
suite sets the role through the [editor fixture](./editor/fixture.md#roles);
the classes below are what it uses.

## `CookieAuthentication`

An `AuthenticationProvider` for the suite's Vite server. It reads the role and
the subject from two cookies and falls back to the server's `defaultRole` and
the connection id when they are missing.
[`RunMode.assetServer`](./config.md#assetserver-runmodeassetserver) creates
one for `--mode e2e`, and [`RunMode.plugins()`](./config.md#plugins-plugin)
adds its plugin.

### `plugin(): Plugin`

Serves `POST /__e2e/revoke?subject=<subject>` during `vite serve`. The request
revokes every connection of that subject: the server closes them with code
`4001`, and the clients reconnect and authenticate again with their current
cookies. A request without a subject gets a 400.

### `revoke(subject: string): void`

Revokes the subject's connections from the server side.

## `ContextAccess`

The role of one subject in one Playwright browser context.

```ts
const access = new ContextAccess({
  context,
  url: baseURL,
  subject: crypto.randomUUID()
});
await access.grant("spectator");
await page.goto(baseURL);

await access.become("member");
```

### `grant(role: string): Promise<void>`

Sets the role and subject cookies for `url`. Call it before the page opens:
a connection reads the cookies when it authenticates.

### `become(role: string): Promise<void>`

Sets the new cookies, then posts to the revoke endpoint so the subject's open
pages reconnect with the new role. It throws when the endpoint does not answer
with a 2xx status. A page that opened before any `grant()` authenticated as
its connection id, so the revoke does not reach it.

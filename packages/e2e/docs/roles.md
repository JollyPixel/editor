# Roles

Gives each browser context its own network role, so a suite can test what a
role may do and what happens when the role changes mid-session.

## `CookieRoles`

An `AuthenticationProvider` for the suite's Vite server. It reads the role and
the subject from two cookies and falls back to the server's `defaultRole` and
the connection id when they are missing.

```ts
const roles = new CookieRoles();

createAssetWorkspacePlugin({
  // ...
  auth: roles,
  defaultRole: "member",
  rights: {
    member: { "*": "write" },
    spectator: {
      "*.$join": "write",
      "*.$presence": "write",
      "*": "read"
    }
  }
});
```

### `plugin(): Plugin`

Serves `POST /__e2e/revoke?subject=<subject>` during `vite serve`. The request
revokes every connection of that subject: the server closes them with code
`4001`, and the clients reconnect and authenticate again with their current
cookies.

### `revoke(subject: string): void`

Revokes the subject's connections from the server side.

## `grantRole(context, url, grant): Promise<void>`

Sets the role and subject cookies for `url` on a Playwright browser context.
Set them before opening the page.

```ts
interface RoleGrant {
  role: string;
  subject: string;
}
```

## `changeRole(context, url, grant): Promise<void>`

Sets the new cookies, then posts to the revoke endpoint so the subject's open
pages reconnect with the new role. It throws when the endpoint does not answer
with a 2xx status.

```ts
const grant = { role: "spectator", subject: crypto.randomUUID() };
await grantRole(context, baseURL, grant);
await page.goto(baseURL);

await changeRole(context, baseURL, { ...grant, role: "member" });
```

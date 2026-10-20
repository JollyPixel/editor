// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import { request } from "@playwright/test";
import { createServer } from "vite";

// Import Internal Dependencies
import {
  ContextAccess,
  type AccessContext
} from "../../src/roles/ContextAccess.ts";
import { CookieAuthentication } from "../../src/roles/CookieAuthentication.ts";

// CONSTANTS
const kSubject = "subject-1";
const kRequest = {
  clientId: "client-1",
  url: "/",
  defaultRole: "member"
};

interface CookieJar extends AsyncDisposable {
  context: AccessContext;
  header(): string;
}

async function cookieJar(): Promise<CookieJar> {
  const cookies = new Map<string, string>();
  const context: AccessContext = {
    request: await request.newContext(),
    async addCookies(added) {
      for (const { name, value } of added) {
        cookies.set(name, value);
      }
    }
  };

  return {
    context,
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
    async [Symbol.asyncDispose]() {
      await context.request.dispose();
    }
  };
}

describe("roles", () => {
  it("authenticates a granted context with its role and subject", async() => {
    await using jar = await cookieJar();
    const access = new ContextAccess({
      context: jar.context,
      url: "http://localhost:3999",
      subject: kSubject
    });

    await access.grant("spectator");

    assert.deepEqual(new CookieAuthentication().authenticate({
      ...kRequest,
      headers: { cookie: jar.header() }
    }), {
      subject: kSubject,
      role: "spectator"
    });
  });

  it("authenticates a context without a grant as its client with the default role", () => {
    assert.deepEqual(new CookieAuthentication().authenticate({
      ...kRequest,
      headers: {}
    }), {
      subject: "client-1",
      role: "member"
    });
  });

  it("revokes the subject through the dev server when a context becomes another role", async() => {
    const auth = new CookieAuthentication();
    const revoked: string[] = [];
    auth.watchRevocations((subject) => revoked.push(subject));
    const server = await createServer({
      configFile: false,
      logLevel: "silent",
      server: {
        port: 0
      },
      plugins: [
        auth.plugin()
      ]
    });
    await server.listen();
    await using jar = await cookieJar();

    try {
      const access = new ContextAccess({
        context: jar.context,
        url: server.resolvedUrls!.local[0],
        subject: kSubject
      });
      await access.become("spectator");

      assert.deepEqual(revoked, [kSubject]);
      assert.equal(auth.authenticate({
        ...kRequest,
        headers: { cookie: jar.header() }
      }).role, "spectator");
    }
    finally {
      await server.close();
    }
  });
});

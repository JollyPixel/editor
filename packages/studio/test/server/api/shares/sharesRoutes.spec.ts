// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { ShareLink } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  listenStudioApi,
  type Browser,
  type StudioApiAccountsOptions,
  type StudioApiServer
} from "../../../helpers/studioApi.ts";
import {
  SHARES_URL_PATH,
  type CreatedShareReply,
  type ShareLinksReply
} from "../../../../src/shares/routes.ts";

// CONSTANTS
const kPassword = "correct horse";

interface SharesHarness extends AsyncDisposable {
  server: StudioApiServer;
  admin: Browser;
  bob: Browser;
  carol: Browser;
}

async function sharesHarness(
  options: StudioApiAccountsOptions = {}
): Promise<SharesHarness> {
  const server = await listenStudioApi({
    ...options,
    closures: {
      "map-1": ["map-1"],
      "map-2": ["map-2"]
    }
  });
  const [admin, bob, carol] = [server.browser(), server.browser(), server.browser()];
  await admin.client.register("Alice", kPassword);
  await bob.client.register("Bob", kPassword);
  await carol.client.register("Carol", kPassword);

  return {
    server,
    admin,
    bob,
    carol,
    [Symbol.asyncDispose]: () => server[Symbol.asyncDispose]()
  };
}

function sharesUrl(
  server: StudioApiServer,
  path = ""
): URL {
  return new URL(SHARES_URL_PATH + path, server.url);
}

function share(
  harness: SharesHarness,
  browser: Browser,
  body: unknown
): Promise<Response> {
  return browser.fetch(sharesUrl(harness.server), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function listed(
  harness: SharesHarness,
  browser: Browser
): Promise<string[]> {
  const response = await browser.fetch(sharesUrl(harness.server));
  assert.equal(response.status, 200);
  const { links } = await response.json() as ShareLinksReply;

  return links.map((link) => link.assetId);
}

async function created(
  response: Response
): Promise<ShareLink> {
  assert.equal(response.status, 201);
  const { link } = await response.json() as CreatedShareReply;

  return link;
}

describe("sharesRoutes", () => {
  test("creates a link with the chosen lifetime that its creator can copy again", async(t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000 });
    await using harness = await sharesHarness({ defaultRole: "member" });

    const link = await created(await share(harness, harness.bob, {
      assetId: "map-1",
      lifetime: "7d"
    }));

    assert.equal(link.assetId, "map-1");
    assert.equal(link.expiresAt, 1_000 + 7 * 24 * 60 * 60 * 1_000);
    assert.deepEqual(harness.server.accounts.shareLinks.find(link.token), link);
    const response = await harness.bob.fetch(sharesUrl(harness.server));
    const { links } = await response.json() as ShareLinksReply;
    assert.deepEqual(links, [link]);
  });

  test("refuses a role without studio.$share, an unknown asset and a signed-out request", async() => {
    await using harness = await sharesHarness();
    const body = {
      assetId: "map-1",
      lifetime: "1d"
    };

    const refused = await share(harness, harness.bob, body);
    const unknown = await share(harness, harness.admin, {
      ...body,
      assetId: "missing"
    });
    const signedOut = await fetch(sharesUrl(harness.server), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const badLifetime = await share(harness, harness.admin, {
      ...body,
      lifetime: "1y"
    });

    assert.deepEqual(
      [refused.status, unknown.status, signedOut.status, badLifetime.status],
      [403, 404, 401, 400]
    );
    assert.equal((await refused.json()).code, "share-link-refused");
    const { canShare } = await (await harness.bob.fetch(sharesUrl(harness.server))).json() as ShareLinksReply;
    assert.equal(canShare, false);
  });

  test("lists a member's own links and every link to an admin", async() => {
    await using harness = await sharesHarness({ defaultRole: "member" });
    await created(await share(harness, harness.bob, {
      assetId: "map-1",
      lifetime: "never"
    }));
    await created(await share(harness, harness.carol, {
      assetId: "map-2",
      lifetime: "never"
    }));

    assert.deepEqual(await listed(harness, harness.bob), ["map-1"]);
    assert.deepEqual(await listed(harness, harness.admin), ["map-1", "map-2"]);
  });

  test("lets the creator and an admin revoke, not another member", async() => {
    await using harness = await sharesHarness({ defaultRole: "member" });
    const bobs = await created(await share(harness, harness.bob, {
      assetId: "map-1",
      lifetime: "never"
    }));
    const carols = await created(await share(harness, harness.carol, {
      assetId: "map-2",
      lifetime: "never"
    }));

    function revoke(
      browser: Browser,
      link: ShareLink
    ): Promise<number> {
      return browser.fetch(sharesUrl(harness.server, link.id), {
        method: "DELETE"
      }).then((response) => response.status);
    }

    assert.deepEqual(
      [
        await revoke(harness.carol, bobs),
        await revoke(harness.bob, bobs),
        await revoke(harness.admin, carols),
        await revoke(harness.admin, carols)
      ],
      [403, 204, 204, 404]
    );
  });
});

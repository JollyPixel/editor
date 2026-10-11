// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { LAUNCH_ELEMENT_ID } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { EditorPackages } from "../../../server/editors/EditorPackages.ts";
import { SharePage } from "../../../server/shares/SharePage.ts";
import {
  PASS_THROUGH_STATUS,
  listen,
  voxelMapEditor
} from "../../helpers/editorPages.ts";
import { shareAccounts } from "../../helpers/shares.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kPage = "<!doctype html><html><head>" +
  "<script type=\"module\" src=\"./assets/index.js\"></script>" +
  "</head><body></body></html>";

interface PageHarness extends AsyncDisposable {
  token: string;
  revoke(): void;
  fetch(pathname: string): Promise<Response>;
}

async function pageHarness(): Promise<PageHarness> {
  const parent = await createTempDir("studio-share-");
  const dist = path.join(parent, "dist");
  await fs.mkdir(dist);
  await fs.writeFile(path.join(dist, "index.html"), kPage);

  const setup = await shareAccounts({
    "map-1": ["map-1"]
  });
  const { accounts, owner, shares } = setup;
  const link = accounts.shareLinks.create({
    assetId: "map-1",
    createdBy: owner.id,
    expiresAt: null
  });
  const page = new SharePage({
    shares,
    editors: new EditorPackages([voxelMapEditor(dist)])
  });
  const server = await listen(page.middleware);

  return {
    token: link.token,
    revoke: () => accounts.shareLinks.revoke(owner.id, link.id),
    fetch: (pathname) => server.fetch(pathname),
    async [Symbol.asyncDispose]() {
      await server[Symbol.asyncDispose]();
      setup[Symbol.dispose]();
      await removeTempDir(parent);
    }
  };
}

describe("SharePage", () => {
  test("serves the asset's editor page with a base and the launch first in the head", async() => {
    await using harness = await pageHarness();

    const response = await harness.fetch(`/view/${harness.token}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    const head = html.slice(html.indexOf("<head>") + "<head>".length);
    assert.ok(head.startsWith("<base href=\"../editors/voxel-map/\">"));
    const launch = head.match(
      new RegExp(`<script type="application/json" id="${LAUNCH_ELEMENT_ID}">(.*?)</script>`)
    );
    assert.deepEqual(JSON.parse(launch?.[1] ?? "null"), {
      target: "map-1",
      credential: harness.token
    });
    assert.ok(head.indexOf(LAUNCH_ELEMENT_ID) < head.indexOf("./assets/index.js"));
  });

  test("answers 404 for an unknown or revoked token", async() => {
    await using harness = await pageHarness();
    const unknown = await harness.fetch("/view/unknown");
    harness.revoke();
    const revoked = await harness.fetch(`/view/${harness.token}`);

    assert.deepEqual([unknown.status, revoked.status], [404, 404]);
    assert.equal(revoked.headers.get("cache-control"), "no-store");
  });

  test("passes on every other path", async() => {
    await using harness = await pageHarness();

    const response = await harness.fetch(`/editors/voxel-map/${harness.token}`);

    assert.equal(response.status, PASS_THROUGH_STATUS);
  });
});

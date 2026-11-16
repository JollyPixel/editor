// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ProjectArchiveClient } from "../../src/project/ProjectArchiveClient.ts";

// CONSTANTS
const kProjectUrl = "http://studio.test/api/project/";
const kGameUrl = "http://studio.test/api/game/";

function gameServer(
  body: () => ReadableStream<Uint8Array>
): { client: ProjectArchiveClient; urls: URL[]; } {
  const urls: URL[] = [];
  function respond(
    input: RequestInfo | URL
  ): Promise<Response> {
    urls.push(new URL(String(input)));

    return Promise.resolve(new Response(body()));
  }
  const client = new ProjectArchiveClient(
    {
      url: kProjectUrl,
      fetch: respond
    },
    {
      url: kGameUrl,
      fetch: respond
    }
  );

  return {
    client,
    urls
  };
}

describe("ProjectArchiveClient", () => {
  test("asks the game export for the assets picked", async() => {
    const { client, urls } = gameServer(() => new Blob(["zip"]).stream());

    await client.downloadGame("all");

    assert.equal(urls[0].searchParams.get("assets"), "all");
  });

  test("names a game export the server stopped on a build error", async() => {
    const { client } = gameServer(() => new ReadableStream({
      pull(controller) {
        controller.error(new TypeError("terminated"));
      }
    }));

    await assert.rejects(
      client.downloadGame("reachable"),
      {
        name: "DownloadStoppedError",
        message: "The export stopped before its end, most likely on an " +
          "asset that fails to build: Play the game to see which one."
      }
    );
  });
});

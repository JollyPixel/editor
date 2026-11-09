// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UnbuildableAssetError,
  type AssetKindHandler
} from "#src/index.ts";
import { UnknownAssetError } from "#src/storage/writer/errors/UnknownAssetError.ts";
import { archiveProject } from "../helpers/archive.ts";
import { text } from "../helpers/bytes.ts";
import {
  liveLinkHandler,
  type LinkCommand,
  type LinkState
} from "../helpers/kinds.ts";

interface BuiltLinks {
  readonly handler: AssetKindHandler<LinkState, LinkCommand>;
  builds: number;
}

function builtLinks(
  type?: string
): BuiltLinks {
  const links: BuiltLinks = {
    handler: {
      ...liveLinkHandler(),
      build: {
        version: "1",
        type,
        build(state): Promise<Uint8Array> {
          links.builds++;

          return Promise.resolve(
            new TextEncoder().encode(state.targets.join("+").toUpperCase())
          );
        }
      }
    },
    builds: 0
  };

  return links;
}

describe("AssetBuilds", () => {
  test("builds the stored content of a closed asset", async() => {
    const links = builtLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass", "sand");

    const built = (await project.backend.builds.build(map)).unwrap();

    assert.strictEqual(text(built.bytes), "GRASS+SAND");
    assert.strictEqual(built.type, "text/plain; charset=utf-8");
  });

  test("serves a build under the media type its hook declares", async() => {
    const links = builtLinks("text/javascript");
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");

    const built = (await project.backend.builds.build(map)).unwrap();

    assert.strictEqual(built.type, "text/javascript");
  });

  test("builds the live state of an open asset before it is saved", async() => {
    const links = builtLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");
    await project.editLive(map, "stone");

    const built = (await project.backend.builds.build(map)).unwrap();

    assert.strictEqual(text(built.bytes), "STONE");
  });

  test("builds each content once, even when an edit comes back to it", async() => {
    const links = builtLinks();
    await using project = await archiveProject({ handlers: [links.handler] });
    const map = await project.link("map.link", "grass");
    const { builds } = project.backend;

    const [first, second] = await Promise.all([
      builds.build(map),
      builds.build(map)
    ]);
    await builds.build(map);
    assert.strictEqual(links.builds, 1);

    await project.editLive(map, "stone");
    await project.backend.flush(map);
    const edited = (await builds.build(map)).unwrap();
    assert.strictEqual(text(edited.bytes), "STONE");
    assert.strictEqual(links.builds, 2);

    await project.editLive(map, "grass");
    await project.backend.flush(map);
    const reverted = (await builds.build(map)).unwrap();
    assert.strictEqual(links.builds, 2);
    assert.strictEqual(reverted.key, first.unwrap().key);
    assert.strictEqual(second.unwrap().key, first.unwrap().key);
    assert.notStrictEqual(edited.key, first.unwrap().key);
  });

  test("refuses a kind without a build", async() => {
    await using project = await archiveProject();
    const map = await project.link("map.link", "grass");

    const built = await project.backend.builds.build(map);

    assert.ok(!built.ok && built.val instanceof UnbuildableAssetError);
  });

  test("refuses an unknown asset", async() => {
    await using project = await archiveProject();

    const built = await project.backend.builds.build("missing");

    assert.ok(!built.ok && built.val instanceof UnknownAssetError);
  });
});

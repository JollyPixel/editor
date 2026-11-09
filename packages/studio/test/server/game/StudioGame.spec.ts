// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import {
  binaryAssetKind,
  createAssetBackend,
  textureAssetKind,
  type AssetBackend
} from "@jolly-pixel/asset-server";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { GameBuildError } from "../../../server/game/errors/GameBuildError.ts";
import { StudioGame } from "../../../server/game/StudioGame.ts";
import { StudioAccess } from "../../../server/project/StudioAccess.ts";
import { UnknownAssetError } from "../../../server/shares/errors/UnknownAssetError.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kAccess = StudioAccess.from({
  defaultRole: "player",
  roles: {
    player: {
      "*.$join": "write",
      "*": "read"
    },
    tester: {
      "texture:*": "void",
      "*.$join": "write",
      "*": "read"
    }
  },
  accessRequests: false
}, "project.json");

function account(
  role: string
): Account {
  return {
    id: role,
    username: role,
    role,
    owner: false
  };
}

interface GameProject extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly game: StudioGame;
  create(path: string, content: string): Promise<string>;
}

async function gameProject(): Promise<GameProject> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [
      textureAssetKind(),
      {
        ...binaryAssetKind,
        kind: "scene",
        extensions: { ".scene.json": "application/json" }
      },
      {
        ...binaryAssetKind,
        kind: "voxelmap",
        extensions: { ".voxelmap.json": "application/json" },
        build: undefined
      }
    ],
    reconcile: {
      watch: false
    }
  });

  return {
    backend,
    game: new StudioGame({
      project: { access: kAccess },
      backend
    }),
    async create(path, content) {
      const created = await backend.writer.create({
        path,
        data: new TextEncoder().encode(content),
        actor: kActor
      });

      return created.unwrap().assetId;
    },
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
    }
  };
}

describe("StudioGame", () => {
  test("lists every asset the account opens, with the path of its build", async() => {
    await using project = await gameProject();
    const scene = await project.create("levels/arena.scene.json", "{}");
    const texture = await project.create("textures/grass.png", "png");

    const player = project.game.manifest(account("player"), scene);
    const tester = project.game.manifest(account("tester"), scene);

    const revision = project.backend.catalog.record(texture)?.revision;
    assert.equal(player.start, scene);
    assert.deepEqual(
      player.assets.assets.find(({ id }) => id === texture),
      {
        id: texture,
        kind: "texture",
        path: "textures/grass.png",
        revision
      }
    );
    assert.equal(
      player.artifacts[texture],
      `builds/${texture}/${encodeURIComponent(revision!)}/grass.png`
    );
    assert.deepEqual(tester.assets.assets.map(({ id }) => id), [scene]);
    assert.deepEqual(Object.keys(tester.artifacts), [scene]);
  });

  test("starts only from a scene the account opens", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    assert.throws(
      () => project.game.manifest(account("player"), texture),
      UnknownAssetError
    );
    assert.throws(
      () => project.game.manifest(account("player"), "missing"),
      UnknownAssetError
    );
  });

  test("serves an artifact for good only at the current revision", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");
    const revision = project.backend.catalog.record(texture)!.revision!;

    const current = await project.game.artifact(account("player"), texture, revision);
    const stale = await project.game.artifact(account("player"), texture, "older");

    assert.equal(new TextDecoder().decode(current.bytes), "png");
    assert.equal(current.type, "image/png");
    assert.equal(current.cacheControl, "private, max-age=31536000, immutable");
    assert.equal(stale.cacheControl, "no-store");
  });

  test("hides an asset the account cannot open", async() => {
    await using project = await gameProject();
    const texture = await project.create("textures/grass.png", "png");

    await assert.rejects(
      project.game.artifact(account("tester"), texture, "any"),
      UnknownAssetError
    );
  });

  test("names the asset a build refuses", async() => {
    await using project = await gameProject();
    const map = await project.create("maps/overworld.voxelmap.json", "{}");

    await assert.rejects(
      project.game.artifact(account("player"), map, "any"),
      (error) => error instanceof GameBuildError &&
        error.message.startsWith("\"maps/overworld.voxelmap.json\" cannot be built")
    );
  });
});

// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SharedSceneViewers } from "#src/scene/SharedSceneViewers.ts";

interface FakeViewer {
  assetId: string;
  attached: number;
  released: boolean;
  loaded: PromiseWithResolvers<void>;
  ready: Promise<void>;
  attach(): () => void;
  release(): void;
}

interface FakeSource {
  viewer: FakeViewer;
  attach(): () => void;
}

function createViewers() {
  const viewers: FakeViewer[] = [];
  const shared = new SharedSceneViewers({
    open: (assetId) => {
      const loaded = Promise.withResolvers<void>();
      const viewer: FakeViewer = {
        assetId,
        attached: 0,
        released: false,
        loaded,
        ready: loaded.promise,
        attach: () => {
          viewer.attached++;

          return () => {
            viewer.attached--;
          };
        },
        release: () => {
          viewer.released = true;
        }
      };
      viewers.push(viewer);

      return viewer;
    },
    source: (viewer, hold): FakeSource => {
      return {
        viewer,
        attach: () => hold(viewer.attach())
      };
    }
  });

  return { shared, viewers };
}

function resolve(
  shared: SharedSceneViewers<FakeViewer, FakeSource>,
  assetId: string
): FakeSource {
  return shared.resolve({ id: assetId, kind: "voxelmap" });
}

describe("SharedSceneViewers", () => {
  it("shares one viewer between the components showing the same asset", () => {
    const { shared, viewers } = createViewers();

    const first = resolve(shared, "asset-a");
    const second = resolve(shared, "asset-a");
    resolve(shared, "asset-b").attach();
    first.attach();
    second.attach();

    assert.deepEqual(viewers.map((viewer) => viewer.assetId), ["asset-a", "asset-b"]);
    assert.equal(first.viewer, second.viewer);
    assert.equal(viewers[0].attached, 2);
  });

  it("releases a viewer once its last view detaches, but not across a rebuild", async() => {
    const { shared, viewers } = createViewers();
    const detachFirst = resolve(shared, "asset").attach();
    const detachSecond = resolve(shared, "asset").attach();

    detachFirst();
    detachSecond();
    const rebuilt = resolve(shared, "asset").attach();
    await Promise.resolve();
    assert.equal(viewers.length, 1);
    assert.equal(viewers[0].released, false);
    assert.equal(viewers[0].attached, 1);

    rebuilt();
    await Promise.resolve();
    assert.equal(viewers[0].released, true);
    resolve(shared, "asset");
    assert.equal(viewers.length, 2);
  });

  it("settles ready once the viewer its components share is ready", async() => {
    const { shared, viewers } = createViewers();
    resolve(shared, "asset").attach();
    let settled = false;
    const ready = shared.ready({ id: "asset", kind: "voxelmap" })
      .then(() => {
        settled = true;
      });

    await Promise.resolve();
    assert.equal(settled, false);
    viewers[0].loaded.resolve();
    await ready;
    assert.equal(viewers.length, 1);
  });

  it("releases every open viewer on dispose", () => {
    const { shared, viewers } = createViewers();
    resolve(shared, "asset").attach();

    shared.dispose();

    assert.equal(viewers[0].released, true);
  });
});

// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server/backend";

// Import Internal Dependencies
import { mountStandalone } from "#src/editor/mountStandalone.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { LaunchNotFoundError } from "#src/launch/errors/LaunchNotFoundError.ts";
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";

describe("mountStandalone", () => {
  test("rejects before any session when no launch source names a target", async() => {
    let mounted = false;
    const editor = {
      accepts: "voxelmap",
      identity: { title: "Join" },
      kinds: [],
      mount: () => {
        mounted = true;

        return Promise.resolve({ dispose: () => void 0 });
      }
    };

    await assert.rejects(
      mountStandalone(editor, {
        sources: [{ read: () => Promise.resolve(undefined) }]
      }),
      LaunchNotFoundError
    );
    assert.equal(mounted, false);
  });

  test("exposes the mounted handle on globalThis under debugHandle", async() => {
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed: {
        "notes/readme.bin": {
          id: "debug-target",
          kind: BINARY_KIND,
          content: () => new Uint8Array([1])
        }
      }
    });

    let shell: unknown = "unset";
    const handle = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        shell = context.shell;

        return Promise.resolve({
          dispose: () => context.session.dispose()
        });
      }
    }, {
      sources: [
        {
          read: () => Promise.resolve(EditorLaunch.fromTarget("debug-target"))
        }
      ],
      connect: () => workspace.connect(),
      debugHandle: "hostTestHandle"
    });

    try {
      assert.equal(Reflect.get(globalThis, "hostTestHandle"), handle);
      assert.equal(shell, null);
    }
    finally {
      Reflect.deleteProperty(globalThis, "hostTestHandle");
      handle.dispose();
      await workspace.close();
    }
  });
});

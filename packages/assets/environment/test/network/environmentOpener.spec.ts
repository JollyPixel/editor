// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EnvironmentDocument } from "#src/index.ts";
import { environmentOpener } from "#src/network/client.ts";

function createSession() {
  const kinds = new Map([
    ["dusk", "environment"],
    ["level", "voxelmap"]
  ]);
  const opened: string[] = [];
  const session = {
    catalog: {
      record: (assetId: string) => {
        const kind = kinds.get(assetId);

        return kind === undefined ? undefined : { kind };
      }
    },
    assets: {
      open: (_kind: unknown, assetId: string) => {
        opened.push(assetId);

        return {
          document: new EnvironmentDocument(),
          release: () => undefined
        };
      }
    }
  };

  return { open: environmentOpener(session), opened };
}

describe("environmentOpener", () => {
  test("opens environment assets only", () => {
    const { open, opened } = createSession();

    assert.notEqual(open("dusk"), null);
    assert.equal(open("level"), null);
    assert.equal(open("missing"), null);
    assert.deepEqual(opened, ["dusk"]);
  });
});

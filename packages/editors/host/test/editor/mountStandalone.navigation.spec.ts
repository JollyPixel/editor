// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import type { EditorContext } from "#src/editor/EditorDefinition.ts";
import { mountStandalone } from "#src/editor/mountStandalone.ts";
import type { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";
import { editorHandle } from "../helpers/editorHandle.ts";
import {
  ASSET_ID,
  OTHER_ASSET_ID,
  definition,
  editorState,
  offlineOptions,
  openWorkspace,
  resetStandalonePage
} from "../helpers/standalone.ts";

async function mountTracked(
  workspace: OfflineWorkspace
) {
  const contexts: EditorContext[] = [];
  const disposed: string[] = [];
  let connections = 0;
  const editor = await mountStandalone(definition((context) => {
    contexts.push(context);
    const target = context.session.target.record.id;

    return Promise.resolve({
      ...editorHandle(context.session),
      dispose: () => {
        disposed.push(target);
      }
    });
  }), {
    ...offlineOptions(workspace),
    connect: () => {
      connections++;

      return workspace.connect();
    }
  });

  return {
    editor,
    contexts,
    disposed,
    connections: () => connections
  };
}

function queriedTarget(): string | null {
  return new URL(location.href).searchParams.get("target");
}

async function untilReady(): Promise<void> {
  do {
    await setImmediate();
  } while (editorState() !== "ready");
}

describe("mountStandalone navigation", () => {
  afterEach(resetStandalonePage);

  test("opening another target remounts the editor on the same connection and follows history", async() => {
    const workspace = await openWorkspace();
    const { editor, contexts, disposed, connections } = await mountTracked(
      workspace
    );

    await contexts[0].toolbar.targets?.open(OTHER_ASSET_ID);

    assert.deepEqual(disposed, [ASSET_ID]);
    assert.equal(editor.handle.session.target.record.id, OTHER_ASSET_ID);
    assert.equal(editor.handle.session.assets.has(ASSET_ID), false);
    assert.equal(connections(), 1);
    assert.equal(queriedTarget(), OTHER_ASSET_ID);
    assert.equal(editorState(), "ready");

    window.history.replaceState(null, "", `/?target=${ASSET_ID}`);
    window.dispatchEvent(new Event("popstate"));
    await untilReady();

    assert.equal(editor.handle.session.target.record.id, ASSET_ID);
    assert.deepEqual(disposed, [ASSET_ID, OTHER_ASSET_ID]);

    editor.dispose();
    await workspace.close();
  });
});

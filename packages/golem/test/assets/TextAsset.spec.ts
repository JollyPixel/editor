// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  textAssetKind,
  textEditableKind,
  type ScriptNetworkCommand,
  type ScriptSnapshot,
  type ScriptText
} from "@jolly-pixel/asset.script";
import {
  SCRIPT_CARET_PRESENCE_KEY,
  TEXT_KIND,
  textDocumentKind
} from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { TextAsset } from "#src/assets/text/TextAsset.ts";
import { TextMatchError } from "#src/assets/text/errors/TextMatchError.ts";
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import { mockOpening } from "../helpers/opening.ts";
import { MockStudio } from "../helpers/MockStudio.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

// CONSTANTS
const kSource = "let a = 1;\nlet b = a;\n";

class Studio extends MockStudio<
  LiveAssetRoom<ScriptText, ScriptNetworkCommand>,
  ScriptNetworkCommand,
  ScriptSnapshot
> {
  readonly text = new TextAsset(mockOpening(this.room), textEditableKind(TEXT_KIND));

  constructor() {
    super(new LiveAssetRoom(textAssetKind()));
  }

  async open(
    source: string
  ): Promise<void> {
    this.server.state.replace(source);
    await this.connect();
    await this.text.ready;
  }

  async settle(): Promise<void> {
    while (this.room.sent.length > 0) {
      await this.answer();
    }
    await this.text.settled();
  }
}

describe("TextAsset", { timeout: 10_000 }, () => {
  test("replaces a unique search, or every occurrence when asked", async() => {
    const studio = new Studio();
    await studio.open(kSource);

    assert.equal(await studio.text.replace("let b", "const b"), 1);
    assert.equal(await studio.text.replace("a", "alpha", { all: true }), 2);
    await studio.settle();

    assert.equal(studio.server.state.text, "let alpha = 1;\nconst b = alpha;\n");
  });

  test("sends nothing for a search that is missing or repeated", async() => {
    const studio = new Studio();
    await studio.open(kSource);

    await assert.rejects(
      studio.text.replace("let c", "let d"),
      (error: unknown) => error instanceof TextMatchError && error.matches === 0
    );
    await assert.rejects(
      studio.text.replace("let", "const"),
      (error: unknown) => error instanceof TextMatchError && error.matches === 2
    );
    assert.deepEqual(studio.room.sent, []);
  });

  test("writes a whole new text", async() => {
    const studio = new Studio();
    await studio.open(kSource);

    await studio.text.write("let a = 2;\n");
    await studio.settle();

    assert.equal(studio.server.state.text, "let a = 2;\n");
  });

  test("reads a range of lines counted from 1", async() => {
    const studio = new Studio();
    await studio.open("one\ntwo\nthree\nfour");

    assert.deepEqual(studio.text.lines({ from: 2, to: 3 }), {
      from: 2,
      to: 3,
      lineCount: 4,
      text: "two\nthree"
    });
    assert.deepEqual(studio.text.lines({ from: 3, to: 9 }), {
      from: 3,
      to: 4,
      lineCount: 4,
      text: "three\nfour"
    });
    assert.equal(studio.text.lines({ from: 9 }).text, "");
    assert.throws(() => studio.text.lines({ from: 0 }), RangeError);
  });

  test("shows a watching person the edit and the golem's caret", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const assetId = await golem.catalog.create("notes/todo.md", null);
    const notes = await golem.open(assetId, "text");
    using person = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: (await createAgentToken(backend, bob, "Watcher")).value,
      assetId,
      documentKind: textDocumentKind(TEXT_KIND)
    });

    await notes.write("- buy bread\n");
    await notes.replace("bread", "milk");
    await notes.settled();
    await person.until(() => person.synced.document.text === "- buy milk\n" &&
      person.peerNamed("Builder")?.presence[SCRIPT_CARET_PRESENCE_KEY] !== undefined);

    assert.deepEqual(person.peerNamed("Builder")?.presence, {
      [SCRIPT_CARET_PRESENCE_KEY]: {
        anchor: 10,
        head: 10
      }
    });
  });
});

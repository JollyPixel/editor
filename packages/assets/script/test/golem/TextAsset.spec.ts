// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TestStudio,
  type HostedAsset
} from "@jolly-pixel/golem.kit/testing";

// Import Internal Dependencies
import {
  textAssetKind,
  type ScriptText
} from "#src/index.ts";
import { SCRIPT_CARET_PRESENCE_KEY } from "#src/network/client.ts";
import {
  GOLEM_KINDS,
  TextMatchError,
  type TextAsset
} from "#src/golem/index.ts";

// CONSTANTS
const kSource = "let a = 1;\nlet b = a;\n";

interface OpenedText {
  text: TextAsset<"text">;
  hosted: HostedAsset<ScriptText>;
}

async function openText(
  source: string
): Promise<OpenedText> {
  const studio = new TestStudio({ kinds: GOLEM_KINDS });
  const hosted = studio.host("notes/todo.md", textAssetKind());
  hosted.state.replace(source);

  return {
    hosted,
    text: await studio.open(hosted.id, "text")
  };
}

describe("TextAsset", () => {
  test("replaces a unique search, or every occurrence when asked", async() => {
    const { text, hosted } = await openText(kSource);

    assert.equal(await text.replace({ search: "let b", replace: "const b" }), 1);
    assert.equal(await text.replace({ search: "a", replace: "alpha", all: true }), 2);
    await text.settled();

    assert.equal(hosted.state.text, "let alpha = 1;\nconst b = alpha;\n");
  });

  test("sends nothing for a search that is missing or repeated", async() => {
    const { text, hosted } = await openText(kSource);

    await assert.rejects(
      text.replace({ search: "let c", replace: "let d" }),
      (error: unknown) => error instanceof TextMatchError && error.matches === 0
    );
    await assert.rejects(
      text.replace({ search: "let", replace: "const" }),
      (error: unknown) => error instanceof TextMatchError && error.matches === 2
    );
    assert.deepEqual(hosted.room.sent, []);
  });

  test("writes a whole new text, with the golem's caret after the edit", async() => {
    const { text, hosted } = await openText("- buy bread\n");

    await text.write({ text: "- buy milk\n" });
    await text.settled();

    assert.equal(hosted.state.text, "- buy milk\n");
    assert.deepEqual(hosted.room.presence, {
      [SCRIPT_CARET_PRESENCE_KEY]: {
        anchor: 10,
        head: 10
      }
    });
  });

  test("reads a range of lines counted from 1", async() => {
    const { text } = await openText("one\ntwo\nthree\nfour");

    assert.deepEqual(text.lines({ from: 2, to: 3 }), {
      from: 2,
      to: 3,
      lineCount: 4,
      text: "two\nthree"
    });
    assert.deepEqual(text.lines({ from: 3, to: 9 }), {
      from: 3,
      to: 4,
      lineCount: 4,
      text: "three\nfour"
    });
    assert.equal(text.lines({ from: 9 }).text, "");
    assert.throws(() => text.lines({ from: 0 }), RangeError);
  });
});

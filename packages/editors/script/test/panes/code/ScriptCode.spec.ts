// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ScriptDocument } from "@jolly-pixel/asset.script/client";
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import "#src/panes/code/ScriptCode.ts";
import { ScriptCollaboration } from "#src/collaboration/ScriptCollaboration.ts";
import {
  FakeScriptRoom,
  scriptGrants
} from "../../helpers/scriptAccess.ts";

// CONSTANTS
const kSource = "let a = 1;\n";

async function mountCode(
  room: FakeScriptRoom
) {
  const script = new ScriptDocument();
  script.load(kSource);
  const code = document.createElement("jolly-script-code");
  document.body.append(code);
  await code.updateComplete;
  code.attach({
    document: script,
    collaboration: new ScriptCollaboration({
      room: new FakeNetwork().connect("A"),
      document: script
    }),
    language: "plaintext",
    access: scriptGrants(room)
  });
  await code.updateComplete;

  return {
    script,
    code,
    textarea: code.shadowRoot!.querySelector("textarea")!
  };
}

function typeAtStart(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  textarea.value = text + textarea.value;
  textarea.setSelectionRange(text.length, text.length);
  textarea.dispatchEvent(new InputEvent("input", {
    data: text,
    inputType: "insertText"
  }));
}

describe("ScriptCode", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("a reader's typing leaves the script alone until the role may edit", async() => {
    const room = new FakeScriptRoom("read");
    const { script, code, textarea } = await mountCode(room);

    typeAtStart(textarea, "x");
    const asReader = [script.text, textarea.value, textarea.readOnly];
    room.allow();
    await code.updateComplete;
    typeAtStart(textarea, "x");

    assert.deepEqual(asReader, [kSource, kSource, true]);
    assert.deepEqual([script.text, textarea.readOnly], [`x${kSource}`, false]);
  });
});

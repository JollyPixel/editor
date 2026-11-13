// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DialogRequest,
  type RequestedDialog
} from "../../../src/containers/dialog/DialogRequest.ts";

type FakeDialog = HTMLElement & RequestedDialog & {
  shown: number;
  returnValues: string[];
};

function createDialog(): FakeDialog {
  const element = document.createElement("div");
  const dialog = Object.assign(element, {
    shown: 0,
    returnValues: [] as string[],
    async showModal(): Promise<void> {
      dialog.shown++;
    },
    close(
      returnValue = ""
    ): void {
      dialog.returnValues.push(returnValue);
      dialog.dispatchEvent(new Event("jolly-close"));
    }
  });

  return dialog;
}

function setup() {
  const dialog = createDialog();
  const focusTarget = document.createElement("button");
  document.body.append(dialog, focusTarget);
  const request = new DialogRequest<string>(
    {
      updateComplete: Promise.resolve(true)
    },
    {
      dialog: () => dialog,
      focus: () => focusTarget
    }
  );

  return {
    dialog,
    focusTarget,
    request
  };
}

async function shown(
  dialog: FakeDialog
): Promise<void> {
  while (dialog.shown === 0) {
    await Promise.resolve();
  }
}

describe("DialogRequest", () => {
  test("open shows the dialog, focuses the target and resolves with the closing result", async() => {
    const { dialog, focusTarget, request } = setup();

    const result = request.open();
    await shown(dialog);
    await Promise.resolve();
    assert.equal(document.activeElement, focusTarget);

    request.confirm("layer");

    assert.equal(await result, "layer");
    assert.deepEqual(dialog.returnValues, ["confirm"]);
    assert.equal(request.pending, false);
  });

  test("cancel before the host renders resolves null and never shows the dialog", async() => {
    const { dialog, request } = setup();

    const result = request.open();
    request.cancel();

    assert.equal(await result, null);
    assert.deepEqual(dialog.returnValues, ["cancel"]);
    assert.equal(dialog.shown, 0);
  });

  test("confirm closes with the given return value", async() => {
    const { dialog, request } = setup();

    const result = request.open();
    request.confirm("pixels", "clear");

    assert.equal(await result, "pixels");
    assert.deepEqual(dialog.returnValues, ["clear"]);
  });

  test("reopening resolves the earlier request with null and shows the dialog once", async() => {
    const { dialog, request } = setup();

    const first = request.open();
    const second = request.open();
    assert.equal(await first, null);
    await shown(dialog);
    request.confirm("second");

    assert.equal(await second, "second");
    assert.equal(dialog.shown, 1);
  });

  test("a close the request did not start resolves null", async() => {
    const { dialog, request } = setup();

    const result = request.open();
    await shown(dialog);
    dialog.dispatchEvent(new Event("jolly-close"));

    assert.equal(await result, null);
  });

  test("a jolly-close bubbling from inside the dialog keeps the request pending", async() => {
    const { dialog, request } = setup();
    const menu = document.createElement("div");
    dialog.append(menu);

    const result = request.open();
    await shown(dialog);
    menu.dispatchEvent(new Event("jolly-close", {
      bubbles: true
    }));

    assert.equal(request.pending, true);
    request.confirm("kept");
    assert.equal(await result, "kept");
  });
});

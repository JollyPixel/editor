// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  MenuSession,
  type MenuEntry
} from "#src/shared/menu/MenuSession.ts";

// CONSTANTS
const kItems: readonly MenuEntry<"rename" | "delete" | "share">[] = [
  {
    id: "rename",
    label: "Rename"
  },
  "separator",
  {
    id: "delete",
    label: "Delete"
  },
  {
    id: "share",
    label: "Share",
    disabled: true
  }
];
const kPoint = {
  x: 5,
  y: 7
};

describe("MenuSession.from", () => {
  test("runs only the enabled actions its entries list, at the point it was asked for", async() => {
    const ran: string[] = [];
    const session = MenuSession.from(kItems, (action, point) => {
      ran.push(`${action}@${point.x},${point.y}`);
    });

    await session.run("delete", kPoint);
    await session.run("separator", kPoint);
    await session.run("duplicate", kPoint);
    await session.run("share", kPoint);

    assert.equal(session.items, kItems);
    assert.deepEqual(ran, ["delete@5,7"]);
  });

  test("an empty menu lists and runs nothing", async() => {
    assert.deepEqual(MenuSession.EMPTY.items, []);
    assert.equal(await MenuSession.EMPTY.run("delete", kPoint), undefined);
  });
});

describe("MenuSession.forRow", () => {
  test("runs an action only while its row exists", async() => {
    const ran: string[] = [];
    let exists = true;
    const session = MenuSession.forRow(kItems, () => exists, (action) => {
      ran.push(action);
    });

    await session.run("rename", kPoint);
    exists = false;
    await session.run("delete", kPoint);

    assert.deepEqual(ran, ["rename"]);
  });
});

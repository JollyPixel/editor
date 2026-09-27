// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  EMPTY_MENU,
  menuSession,
  rowMenuSession,
  type MenuEntry
} from "#src/shared/menuSession.ts";

// CONSTANTS
const kItems: readonly MenuEntry<"rename" | "delete">[] = [
  {
    id: "rename",
    label: "Rename"
  },
  "separator",
  {
    id: "delete",
    label: "Delete"
  }
];
const kPoint = {
  x: 5,
  y: 7
};

describe("menuSession", () => {
  test("runs only the actions its entries list, at the point it was asked for", async() => {
    const ran: string[] = [];
    const session = menuSession(kItems, (action, point) => {
      ran.push(`${action}@${point.x},${point.y}`);
    });

    await session.run("delete", kPoint);
    await session.run("separator", kPoint);
    await session.run("duplicate", kPoint);

    assert.equal(session.items, kItems);
    assert.deepEqual(ran, ["delete@5,7"]);
  });

  test("an empty menu lists and runs nothing", async() => {
    assert.deepEqual(EMPTY_MENU.items, []);
    assert.equal(await EMPTY_MENU.run("delete", kPoint), undefined);
  });
});

describe("rowMenuSession", () => {
  test("runs an action only while its row exists", async() => {
    const ran: string[] = [];
    let exists = true;
    const session = rowMenuSession(kItems, () => exists, (action) => {
      ran.push(action);
    });

    await session.run("rename", kPoint);
    exists = false;
    await session.run("delete", kPoint);

    assert.deepEqual(ran, ["rename"]);
  });
});

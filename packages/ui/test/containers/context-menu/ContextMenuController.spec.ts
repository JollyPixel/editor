// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import type { ContextMenuEntry } from "../../../src/containers/context-menu/ContextMenu.ts";
import { ContextMenuController } from "../../../src/containers/context-menu/ContextMenuController.ts";
import { MenuSession } from "../../../src/containers/context-menu/MenuSession.ts";
import type { JollyContextActionDetail } from "../../../src/containers/events.ts";
import type { JollyContextRequestDetail } from "../../../src/data/tree/contract.ts";

interface FakeMenu {
  items: readonly ContextMenuEntry[];
  openedAt: [number, number] | null;
  openAt(x: number, y: number): void;
}

function createFakeMenu(): FakeMenu {
  return {
    items: [],
    openedAt: null,
    openAt(x, y) {
      this.openedAt = [x, y];
    }
  };
}

function request(
  id: string | null
): CustomEvent<JollyContextRequestDetail> {
  return new CustomEvent("jolly-context-request", {
    detail: {
      id,
      x: 10,
      y: 20
    }
  });
}

function action(
  id: string
): CustomEvent<JollyContextActionDetail> {
  return new CustomEvent("jolly-context-action", {
    detail: { id }
  });
}

describe("ContextMenuController", () => {
  test("opens the requested row's menu and runs the chosen action once", () => {
    const menu = createFakeMenu();
    const ran: string[] = [];
    const controller = new ContextMenuController(
      () => menu,
      (id) => MenuSession.from(
        [
          {
            id: "rename",
            label: "Rename"
          }
        ],
        (chosen, point) => {
          ran.push(`${id}:${chosen}@${point.x},${point.y}`);
        }
      )
    );

    controller.onContextRequest(request("row"));
    controller.onContextAction(action("rename"));
    controller.onContextAction(action("rename"));

    assert.deepEqual(menu.openedAt, [10, 20]);
    assert.equal(menu.items.length, 1);
    assert.deepEqual(ran, ["row:rename@10,20"]);
  });

  test("runs a toolbar action at the button's point without opening the menu", async() => {
    const menu = createFakeMenu();
    const ran: string[] = [];
    const controller = new ContextMenuController(
      () => menu,
      (id) => MenuSession.from(
        [
          {
            id: "delete",
            label: "Delete"
          }
        ],
        (chosen, point) => {
          ran.push(`${id}:${chosen}@${point.x},${point.y}`);
        }
      )
    );

    await controller.run("row", "delete", { x: 3, y: 4 });

    assert.equal(menu.openedAt, null);
    assert.deepEqual(ran, ["row:delete@3,4"]);
  });
});

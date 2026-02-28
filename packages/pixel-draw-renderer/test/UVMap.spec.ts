// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVMap,
  type UVMapChangedDetail
} from "../src/UVMap.ts";

function collectEvents(uvMap: UVMap): UVMapChangedDetail[] {
  const events: UVMapChangedDetail[] = [];
  uvMap.addEventListener("changed", (e) => {
    events.push((e as CustomEvent<UVMapChangedDetail>).detail);
  });

  return events;
}

function makeData() {
  return {
    label: "Top",
    u: 0.0,
    v: 0.0,
    width: 0.25,
    height: 0.25,
    color: "#f00"
  };
}

describe("UVMap", () => {
  let uvMap: UVMap;

  beforeEach(() => {
    uvMap = new UVMap();
  });

  describe("add / remove / get / has / size / iterator", () => {
    test("add returns a region with the data", () => {
      const r = uvMap.add(makeData());
      assert.ok(r.id.length > 0);
      assert.strictEqual(r.label, "Top");
    });

    test("add with explicit id uses that id", () => {
      const r = uvMap.add({ ...makeData(), id: "myId" });
      assert.strictEqual(r.id, "myId");
    });

    test("get retrieves the region by id", () => {
      const r = uvMap.add(makeData());
      assert.strictEqual(uvMap.get(r.id), r);
    });

    test("has returns false for unknown id", () => {
      assert.strictEqual(uvMap.has("nope"), false);
    });

    test("remove deletes the region", () => {
      const r = uvMap.add(makeData());
      uvMap.remove(r.id);
      assert.strictEqual(uvMap.has(r.id), false);
    });

    test("size reflects number of regions", () => {
      assert.strictEqual(uvMap.size, 0);
      uvMap.add(makeData());
      uvMap.add(makeData());
      assert.strictEqual(uvMap.size, 2);
    });

    test("[Symbol.iterator] yields all regions", () => {
      uvMap.add(makeData());
      uvMap.add(makeData());
      const ids = [...uvMap].map((r) => r.id);
      assert.strictEqual(ids.length, 2);
    });
  });

  describe("select", () => {
    test("select updates selectedId and fires 'select' event", () => {
      const r = uvMap.add(makeData());
      const events = collectEvents(uvMap);
      uvMap.select(r.id);
      assert.strictEqual(uvMap.selectedId, r.id);
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].type, "select");
      assert.strictEqual(events[0].regionId, r.id);
    });

    test("select(null) clears selection", () => {
      const r = uvMap.add(makeData());
      uvMap.select(r.id);
      uvMap.select(null);
      assert.strictEqual(uvMap.selectedId, null);
    });
  });

  describe("createRegion", () => {
    test("adds the region and fires 'add' event", () => {
      const events = collectEvents(uvMap);
      uvMap.createRegion(makeData());
      assert.strictEqual(uvMap.size, 1);
      assert.strictEqual(events[0].type, "add");
    });

    test("undo removes the region", () => {
      uvMap.createRegion(makeData());
      uvMap.undo();
      assert.strictEqual(uvMap.size, 0);
    });

    test("redo re-adds the region", () => {
      uvMap.createRegion(makeData());
      uvMap.undo();
      uvMap.redo();
      assert.strictEqual(uvMap.size, 1);
    });

    test("canUndo is true after createRegion", () => {
      uvMap.createRegion(makeData());
      assert.strictEqual(uvMap.canUndo, true);
    });
  });

  describe("deleteRegion", () => {
    test("removes the region and fires 'remove' event", () => {
      const r = uvMap.add(makeData());
      const events = collectEvents(uvMap);
      uvMap.deleteRegion(r.id);
      assert.strictEqual(uvMap.size, 0);
      assert.strictEqual(events[0].type, "remove");
    });

    test("deleteRegion on unknown id does nothing", () => {
      uvMap.deleteRegion("nonexistent");
      assert.strictEqual(uvMap.size, 0);
    });

    test("undo restores the region", () => {
      const r = uvMap.add({ ...makeData(), id: "fixed" });
      uvMap.deleteRegion(r.id);
      uvMap.undo();
      assert.strictEqual(uvMap.size, 1);
      assert.ok(uvMap.has("fixed"));
    });
  });

  describe("moveRegion", () => {
    test("moves the region by the given delta", () => {
      const r = uvMap.add({ ...makeData(), u: 0.1, v: 0.1 });
      uvMap.moveRegion(r.id, 0.1, 0.05);
      assert.ok(Math.abs(r.u - 0.2) < 1e-10);
      assert.ok(Math.abs(r.v - 0.15) < 1e-10);
    });

    test("fires 'move' changed event", () => {
      const r = uvMap.add(makeData());
      const events = collectEvents(uvMap);
      uvMap.moveRegion(r.id, 0.1, 0);
      assert.strictEqual(events[0].type, "move");
    });

    test("undo reverses the move", () => {
      const r = uvMap.add({ ...makeData(), u: 0.1, v: 0.1 });
      uvMap.moveRegion(r.id, 0.2, 0.1);
      uvMap.undo();
      assert.ok(Math.abs(r.u - 0.1) < 1e-10);
      assert.ok(Math.abs(r.v - 0.1) < 1e-10);
    });

    test("redo re-applies the move", () => {
      const r = uvMap.add({ ...makeData(), u: 0.1, v: 0.1 });
      uvMap.moveRegion(r.id, 0.2, 0.1);
      uvMap.undo();
      uvMap.redo();
      assert.ok(Math.abs(r.u - 0.3) < 1e-10);
      assert.ok(Math.abs(r.v - 0.2) < 1e-10);
    });

    test("clamps to [0, 1]", () => {
      const r = uvMap.add({ ...makeData(), u: 0.9, v: 0.9, width: 0.05, height: 0.05 });
      uvMap.moveRegion(r.id, 0.5, 0.5);
      assert.ok(r.u <= 1);
      assert.ok(r.v <= 1);
    });

    test("moveRegion on unknown id does nothing", () => {
      assert.doesNotThrow(() => uvMap.moveRegion("nope", 0.1, 0.1));
    });
  });

  describe("resizeRegion", () => {
    test("edge-r increases width", () => {
      const r = uvMap.add({ ...makeData(), u: 0, v: 0, width: 0.25, height: 0.25 });
      uvMap.resizeRegion(r.id, "edge-r", { du: 0.1, dv: 0 });
      assert.ok(Math.abs(r.width - 0.35) < 1e-10);
    });

    test("undo restores original dimensions", () => {
      const r = uvMap.add({ ...makeData(), u: 0, v: 0, width: 0.25, height: 0.25 });
      uvMap.resizeRegion(r.id, "edge-r", { du: 0.1, dv: 0 });
      uvMap.undo();
      assert.ok(Math.abs(r.width - 0.25) < 1e-10);
    });

    test("redo re-applies the resize", () => {
      const r = uvMap.add({ ...makeData(), u: 0, v: 0, width: 0.25, height: 0.25 });
      uvMap.resizeRegion(r.id, "edge-r", { du: 0.1, dv: 0 });
      uvMap.undo();
      uvMap.redo();
      assert.ok(Math.abs(r.width - 0.35) < 1e-10);
    });
  });

  describe("setLabel", () => {
    test("updates the region label", () => {
      const r = uvMap.add(makeData());
      uvMap.setLabel(r.id, "New Label");
      assert.strictEqual(r.label, "New Label");
    });

    test("fires 'label' changed event", () => {
      const r = uvMap.add(makeData());
      const events = collectEvents(uvMap);
      uvMap.setLabel(r.id, "X");
      assert.strictEqual(events[0].type, "label");
    });

    test("undo restores old label", () => {
      const r = uvMap.add({ ...makeData(), label: "Old" });
      uvMap.setLabel(r.id, "New");
      uvMap.undo();
      assert.strictEqual(r.label, "Old");
    });
  });

  describe("toJSON / fromJSON", () => {
    test("toJSON returns array of region data", () => {
      uvMap.add({ ...makeData(), id: "a" });
      uvMap.add({ ...makeData(), id: "b" });
      const json = uvMap.toJSON();
      assert.strictEqual(json.length, 2);
      assert.ok(json.find((d) => d.id === "a"));
      assert.ok(json.find((d) => d.id === "b"));
    });

    test("fromJSON restores all regions", () => {
      uvMap.add({ ...makeData(), id: "a", label: "A" });
      uvMap.add({ ...makeData(), id: "b", label: "B" });
      const json = uvMap.toJSON();

      const restored = UVMap.fromJSON(json);
      assert.strictEqual(restored.size, 2);
      assert.strictEqual(restored.get("a")?.label, "A");
      assert.strictEqual(restored.get("b")?.label, "B");
    });

    test("fromJSON → toJSON roundtrip", () => {
      uvMap.add({ ...makeData(), id: "a", u: 0.25, v: 0.5 });
      const json = uvMap.toJSON();
      const restored = UVMap.fromJSON(json);
      assert.deepStrictEqual(restored.toJSON(), json);
    });
  });
});

// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeMap, type EventPayload } from "../helpers/uv-map.ts";

describe("UVMap — selectedSlot", () => {
  test("stays null for a stacked region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.select(region.id, "top");

    assert.strictEqual(map.selectedSlot, null);
  });

  test("defaults to front when an free region is selected without a face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");

    map.select(region.id);

    assert.strictEqual(map.selectedSlot, "front");
  });

  test("keeps the requested face for an free region", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");

    map.select(region.id, "bottom");

    assert.strictEqual(map.selectedSlot, "bottom");
  });

  test("defaults to the first active face for custom topology", () => {
    const map = makeMap();
    const region = map.create({
      width: 4,
      height: 4,
      activeSlots: ["top", "left"]
    });

    map.select(region.id);

    assert.strictEqual(map.selectedSlot, "top");
  });

  test("replaces an inactive requested face with the first active face", () => {
    const map = makeMap();
    const region = map.create({
      width: 4,
      height: 4,
      activeSlots: ["top", "left"]
    });

    map.select(region.id, "front");

    assert.strictEqual(map.selectedSlot, "top");
  });

  test("is renormalized when the selected region stacks", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.select(region.id, "bottom");

    map.setState(region.id, "stacked");

    assert.strictEqual(map.selectedSlot, null);
  });

  test("emits selection-changed when stacking clears the face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.select(region.id, "bottom");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.setState(region.id, "stacked");

    assert.deepStrictEqual(events, [
      { selectedRegionId: region.id, selectedSlot: null }
    ]);
  });

  test("emits selection-changed when the face alone changes", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.setState(region.id, "free");
    map.select(region.id, "front");
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id, "back");
    map.select(region.id, "back");

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].selectedSlot, "back");
  });
});

describe("UVMap — select / visibility", () => {
  test("nothing is visible by default", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    assert.ok(!map.isVisible(region.id));
  });

  test("a selected region becomes visible", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });

    map.select(region.id);
    assert.ok(map.isVisible(region.id));
  });

  test("showAll makes every region visible regardless of selection", () => {
    const map = makeMap();
    const a = map.create({ width: 4, height: 4 });
    const b = map.create({ width: 4, height: 4 });

    map.showAll = true;
    assert.ok(map.isVisible(a.id));
    assert.ok(map.isVisible(b.id));
  });

  test("ignores selecting an unknown id", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select("no-such");

    assert.strictEqual(map.selectedRegionId, region.id);
  });

  test("select(null) deselects", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);

    map.select(null);

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("emits selection-changed only when the selection actually changes", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (e) => events.push(e));

    map.select(region.id);
    map.select(region.id);
    map.select(null);

    assert.strictEqual(events.length, 2);
  });

  test("emits visibility-changed only when showAll actually changes", () => {
    const map = makeMap();
    const events: EventPayload<"visibility-changed">[] = [];
    map.on("visibility-changed", (e) => events.push(e));

    map.showAll = true;
    map.showAll = true;
    map.showAll = false;

    assert.strictEqual(events.length, 2);
  });

  test("region labels are hidden by default", () => {
    assert.strictEqual(makeMap().showRegionLabels, false);
  });

  test("emits label-visibility-changed only when the preference changes", () => {
    const map = makeMap();
    const events: EventPayload<"label-visibility-changed">[] = [];
    map.on("label-visibility-changed", (e) => events.push(e));

    map.showRegionLabels = true;
    map.showRegionLabels = true;
    map.showRegionLabels = false;

    assert.deepStrictEqual(events, [
      { showRegionLabels: true },
      { showRegionLabels: false }
    ]);
  });

  test("emits one consolidated change signal per visible mutation", () => {
    const map = makeMap();
    let changes = 0;
    map.on("changed", () => changes++);

    const region = map.create({ width: 4, height: 4 });
    map.select(region.id);
    map.showRegionLabels = true;
    map.showRegionLabels = true;

    assert.strictEqual(changes, 3);
  });
});

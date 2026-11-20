// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SignalTargets,
  type SignalComponent
} from "#src/features/signals/SignalTargets.ts";

// CONSTANTS
const kPulled = {
  key: "pulled",
  params: [{ name: "force", type: "number" }]
};
const kComponents: SignalComponent[] = [
  {
    id: "lever",
    actorName: "Lever",
    label: "Lever script",
    signals: { signals: [kPulled], methods: [] }
  },
  {
    id: "door",
    actorName: "Door",
    label: "Door script",
    signals: {
      signals: [],
      methods: [
        { key: "open", params: [{ name: "force", type: "number" }] },
        { key: "slam", params: [{ name: "force", type: "" }, { name: "noise", type: "" }] }
      ]
    }
  },
  {
    id: "gate",
    actorName: "Gate",
    label: "Gate script",
    signals: null
  }
];

function createTargets(
  components: SignalComponent[]
): SignalTargets {
  return new SignalTargets(
    (id) => components.find((component) => component.id === id) ?? null
  );
}

function connection(
  target: string,
  method: string
) {
  return {
    id: "c1",
    signal: "pulled",
    target,
    method
  };
}

describe("SignalTargets", () => {
  test("offers the components that have methods, grouped by actor", () => {
    const targets = createTargets(kComponents);

    assert.deepEqual(targets.options(kComponents.map(({ id }) => id)), [
      { value: "door", label: "Door script", group: "Door" }
    ]);
    assert.deepEqual(
      targets.methodOptions("door").map(({ label }) => label),
      ["open(force: number)", "slam(force, noise)"]
    );
  });

  const problems: [string, ReturnType<typeof connection>, string | null][] = [
    ["a method the target declares", connection("door", "open"), null],
    ["a target still loading", connection("gate", "close"), null],
    ["a removed target", connection("ghost", "open"), "The target component no longer exists."],
    ["a method the target lacks", connection("door", "lock"), "Door script has no method lock."],
    [
      "a method taking more arguments than the signal sends",
      connection("door", "slam"),
      "slam takes 2 arguments, the signal sends 1."
    ]
  ];

  for (const [name, wired, expected] of problems) {
    test(`reports ${expected === null ? "no problem" : "a problem"} for ${name}`, () => {
      assert.equal(createTargets(kComponents).problem(wired, kPulled), expected);
    });
  }

  test("names the target of a connection by actor and component", () => {
    const targets = createTargets(kComponents);

    assert.equal(targets.describe(connection("door", "open")), "Door › Door script.open()");
    assert.equal(targets.describe(connection("ghost", "open")), "Missing component.open()");
  });
});

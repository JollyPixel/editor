// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ChordConflictError,
  InvalidPreferencesError,
  PreferenceScope,
  defineKeyBindings,
  definePreferences
} from "#src/index.ts";

// CONSTANTS
const kView = definePreferences({
  name: "view",
  label: "View",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: true
    },
    lighting: {
      type: "enum",
      label: "Lighting",
      options: [
        {
          value: "day",
          label: "Day"
        },
        {
          value: "night",
          label: "Night"
        }
      ],
      default: "day"
    },
    speed: {
      type: "range",
      label: "Speed",
      min: 0.25,
      max: 4,
      default: 1
    },
    frame: {
      type: "chord",
      label: "Frame selection",
      default: ["f"]
    },
    background: {
      type: "color",
      label: "Background",
      default: null
    }
  }
});

const kKeys = defineKeyBindings({
  name: "keys",
  label: "Keys",
  defaults: {
    undo: "Mod+z",
    copy: "Mod+c",
    paste: "Mod+v"
  },
  actions: {
    undo: {
      label: "Undo"
    },
    copy: {
      label: "Copy",
      group: "Clipboard"
    },
    paste: {
      label: "Paste",
      group: "Clipboard"
    }
  }
});

const kHeld = definePreferences({
  name: "held",
  label: "Held keys",
  fields: {
    invertY: {
      type: "boolean",
      label: "Invert Y",
      group: "Look",
      default: false
    },
    forward: {
      type: "key",
      label: "Forward",
      group: "Fly",
      default: ["KeyW"]
    },
    up: {
      type: "key",
      label: "Up",
      group: "Fly",
      default: ["Space"]
    },
    lookUp: {
      type: "key",
      label: "Look up",
      group: "Look",
      default: ["KeyI"]
    }
  }
});

describe("PreferenceScope", () => {
  test("resolves overrides over the field defaults", () => {
    assert.deepEqual(kView.resolve({ lighting: "night" }), {
      grid: true,
      lighting: "night",
      speed: 1,
      frame: ["f"],
      background: null
    });
  });

  test("prunes unknown fields, refused values and defaults", () => {
    assert.deepEqual(kView.prune({
      grid: false,
      lighting: "dusk",
      speed: 1,
      frame: ["f"],
      retired: true
    }), {
      grid: false
    });
    assert.deepEqual(kView.prune("dark"), {});
  });

  test("parse refuses unknown fields and refused values", () => {
    assert.throws(
      () => kView.parse({ retired: true }),
      InvalidPreferencesError
    );
    assert.throws(
      () => kView.parse({ speed: 5 }),
      InvalidPreferencesError
    );
    assert.throws(
      () => kView.parse({ frame: ["a", "b", "c", "d", "e"] }),
      InvalidPreferencesError
    );
    assert.throws(
      () => kView.parse({ background: "red" }),
      InvalidPreferencesError
    );
    assert.deepEqual(kView.parse({ speed: 2, grid: true }), { speed: 2 });
    assert.deepEqual(kView.parse({ background: "#A0B1C2" }), {
      background: "#a0b1c2"
    });
  });

  test("updating a field to its default removes the override", () => {
    const overrides = kView.update({ frame: ["g"] }, { frame: ["f"] });

    assert.deepEqual(overrides, {});
  });

  test("splits chord fields from form fields, by group", () => {
    assert.deepEqual(
      kView.form.flatMap((group) => group.fields.map(([key]) => key)),
      ["grid", "lighting", "speed", "background"]
    );
    assert.deepEqual(
      kKeys.keyBindings.map((group) => [
        group.label,
        group.fields.map(([key]) => key)
      ]),
      [[null, ["undo"]], ["Clipboard", ["copy", "paste"]]]
    );
    assert.deepEqual(kKeys.form, []);
  });

  test("refuses a chord another field of the scope holds", () => {
    assert.throws(
      () => kKeys.update({}, { copy: ["Mod+z"] }),
      (error: unknown) => error instanceof ChordConflictError &&
        error.chord === "Mod+z" &&
        error.key === "copy" &&
        error.owner === "undo"
    );
    assert.throws(
      () => kKeys.update({ undo: ["Mod+u"] }, { copy: ["Mod+z"], undo: ["Mod+z"] }),
      ChordConflictError
    );
  });

  test("lists held-key fields with the bindings, refusing chords and shared keys", () => {
    assert.deepEqual(
      kHeld.keyBindings.map((group) => group.label),
      ["Fly", "Look"]
    );
    assert.throws(
      () => kHeld.update({}, { forward: ["Mod+w"] }),
      (error: unknown) => error instanceof InvalidPreferencesError &&
        !(error instanceof ChordConflictError)
    );
    assert.throws(
      () => kHeld.update({}, { forward: ["Space"] }),
      ChordConflictError
    );
  });

  test("accepts two fields trading chords in one update", () => {
    assert.deepEqual(
      kKeys.update({}, { undo: ["Mod+c"], copy: ["Mod+z"] }),
      {
        undo: ["Mod+c"],
        copy: ["Mod+z"]
      }
    );
  });

  test("round-trips through its JSON descriptor", () => {
    const scope = PreferenceScope.from(
      JSON.parse(JSON.stringify(kView))
    );

    assert.equal(scope.name, "view");
    assert.deepEqual(scope.parse({ lighting: "night" }), {
      lighting: "night"
    });
  });

  test("refuses a definition whose default it would refuse", () => {
    assert.throws(() => definePreferences({
      name: "view",
      label: "View",
      fields: {
        speed: {
          type: "range",
          label: "Speed",
          min: 1,
          max: 2,
          default: 3
        }
      }
    }), InvalidPreferencesError);
    assert.throws(() => defineKeyBindings({
      name: "keys",
      label: "Keys",
      defaults: {
        undo: "Mod+z",
        redo: "Mod+z"
      },
      actions: {
        undo: {
          label: "Undo"
        },
        redo: {
          label: "Redo"
        }
      }
    }), ChordConflictError);
    assert.throws(() => definePreferences({
      name: "View",
      label: "View",
      fields: {}
    }), InvalidPreferencesError);
  });
});

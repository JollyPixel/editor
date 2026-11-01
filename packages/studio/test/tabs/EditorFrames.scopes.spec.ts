// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  parseLaunchMessage,
  preferencesMessage,
  READY_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import { definePreferences, Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import {
  disposeFrames,
  editorFrames,
  FRAME_ORIGIN,
  postFrom,
  recordPosts
} from "../helpers/editorFrames.ts";
import {
  MAP_TAB,
  MODEL_TAB
} from "../helpers/editorTabs.ts";

// CONSTANTS
const kMapScope = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      default: true
    }
  }
});
const kModelScope = definePreferences({
  name: "voxel-model",
  label: "Voxel model",
  fields: {
    glow: {
      type: "boolean",
      label: "Glow",
      default: true
    }
  }
});
const kPixelArtScope = definePreferences({
  name: "pixel-art",
  label: "Pixel art",
  fields: {
    palette: {
      type: "boolean",
      label: "Palette",
      default: false
    }
  }
});
const kScopes = PreferenceScopes.studio([
  {
    name: "voxel-map",
    scopes: [kMapScope],
    shared: [kPixelArtScope]
  },
  {
    name: "voxel-model",
    scopes: [kModelScope],
    shared: [kPixelArtScope]
  }
]);

afterEach(disposeFrames);

function openMapAndModel(
  options: Parameters<typeof editorFrames>[0] = {}
) {
  const frames = editorFrames({
    scopes: kScopes,
    ...options
  });
  frames.show(MAP_TAB);
  frames.show(MODEL_TAB);
  const [map, model] = document.querySelectorAll("iframe");

  return {
    map,
    model,
    mapPosts: recordPosts(map),
    modelPosts: recordPosts(model)
  };
}

describe("EditorFrames preference scopes", () => {
  test("launches a frame with the host scopes and its editor's own and shared scopes", () => {
    const preferences = new Preferences({
      overrides: [
        ["runtime", { stats: false }],
        ["studio", { theme: "light" }],
        ["voxel-map", { grid: false }],
        ["voxel-model", { glow: false }],
        ["pixel-art", { palette: true }]
      ]
    });
    const { map, model, mapPosts, modelPosts } = openMapAndModel({ preferences });

    postFrom(map.contentWindow, { type: READY_MESSAGE_TYPE });
    postFrom(model.contentWindow, { type: READY_MESSAGE_TYPE });

    assert.deepEqual(parseLaunchMessage(mapPosts[0]?.[0])?.preferences, {
      runtime: { stats: false },
      "voxel-map": { grid: false },
      "pixel-art": { palette: true }
    });
    assert.deepEqual(parseLaunchMessage(modelPosts[0]?.[0])?.preferences, {
      runtime: { stats: false },
      "voxel-model": { glow: false },
      "pixel-art": { palette: true }
    });
  });

  test("pushes a change only to the frames whose editor reads its scope", () => {
    const preferences = new Preferences();
    const { mapPosts, modelPosts } = openMapAndModel({ preferences });

    preferences.assign(kMapScope, "grid", false);
    preferences.assign(kPixelArtScope, "palette", true);

    const palette = [preferencesMessage("pixel-art", { palette: true }), FRAME_ORIGIN];
    assert.deepEqual(mapPosts, [
      [preferencesMessage("voxel-map", { grid: false }), FRAME_ORIGIN],
      palette
    ]);
    assert.deepEqual(modelPosts, [palette]);
  });

  test("drops a frame's update-preferences for a scope its editor does not read", () => {
    const received: ShellCommand[] = [];
    const { map } = openMapAndModel({
      onShellCommand: (command) => {
        received.push(command);
      }
    });

    for (const scope of ["voxel-model", "studio", "voxel-map"]) {
      postFrom(map.contentWindow, {
        type: SHELL_MESSAGE_TYPE,
        command: "update-preferences",
        scope,
        patch: {}
      });
    }

    assert.deepEqual(
      received.map((command) => command.command === "update-preferences" && command.scope),
      ["voxel-map"]
    );
  });
});
